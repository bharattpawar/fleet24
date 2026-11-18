import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { Request, Response } from 'express';
import { PaymentsService } from './payments.service';
import { RefundReconciliationService } from './refund-reconciliation.service';
import { VerifyPaymentDto } from './dto/payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, CurrentUser, AuthenticatedUserPayload } from '../auth/decorators/auth.decorators';
import {
  escapeHtml,
  parsePaymentReturnAllowlist,
  resolvePaymentReturnUrl,
  toInlineScriptLiteral,
} from './payment-return-url.util';

@Controller()
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly reconciliationService: RefundReconciliationService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Admin Manual Reconciliation Endpoint
   * POST /api/v1/admin/refunds/reconcile-pending
   */
  @Post('admin/refunds/reconcile-pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @HttpCode(HttpStatus.OK)
  async reconcilePendingRefunds(
    @Body('batchSize') batchSize?: number,
  ) {
    const limit = batchSize && batchSize > 0 && batchSize <= 100 ? batchSize : 25;
    return this.reconciliationService.reconcileBatch(limit);
  }

  /**
   * 1. Create Payment Session
   * Accessible via /api/v1/payments/orders/:orderId/session or /api/v1/orders/:orderId/payment-session
   */
  @Post('payments/orders/:orderId/session')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  async createSession(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Param('orderId') orderId: string,
  ) {
    return this.paymentsService.createPaymentSession(user.userId, orderId);
  }

  /**
   * 2. Verify Payment
   * Customer submits Razorpay Checkout signature for cryptographic verification and reconciliation
   */
  @Post('payments/verify')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('customer')
  @HttpCode(HttpStatus.OK)
  async verifyPayment(
    @CurrentUser() user: AuthenticatedUserPayload,
    @Body() dto: VerifyPaymentDto,
  ) {
    return this.paymentsService.verifyPayment(user.userId, dto);
  }

  /**
   * 3. Razorpay Webhook Endpoint
   * Public to Razorpay servers, secured by HMAC-SHA256 signature against exact raw request body
   */
  @Post('payments/webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: Request,
    @Headers('x-razorpay-signature') signature: string,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing x-razorpay-signature header.');
    }

    // Access raw body captured by NestFactory.create({ rawBody: true })
    const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(req.body));
    return this.paymentsService.handleWebhook(rawBody, signature);
  }

  /**
   * 4. Safe Checkout Page for Expo Go WebBrowser
   * Renders Razorpay Standard Checkout with custom redirect handler.
   * Public (opened in a browser without the app's bearer token), so it only serves orders still
   * awaiting payment, only returns to allowlisted URLs, and escapes every interpolated value.
   */
  @Get('payments/checkout/:orderId')
  async renderCheckout(
    @Param('orderId', new ParseUUIDPipe()) orderId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const details = await this.paymentsService.getOrderForCheckout(orderId);
    const order = details.order;
    const payment = details.payment;

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');

    if (order.status !== 'pending_payment') {
      return res
        .status(409)
        .type('html')
        .send('<html><body><h3>This order is not awaiting payment.</h3></body></html>');
    }

    if (!payment?.providerOrderId) {
      return res
        .status(400)
        .type('html')
        .send('<html><body><h3>Payment session not initialized for this order.</h3></body></html>');
    }

    const returnUrl = this.resolveReturnUrl(req.query.returnUrl);
    const nonce = randomBytes(16).toString('base64');

    res.setHeader(
      'Content-Security-Policy',
      `script-src 'nonce-${nonce}' https://checkout.razorpay.com https://*.razorpay.com; object-src 'none'; base-uri 'none'`,
    );

    const checkoutConfig = {
      key: details.keyId,
      amount: String(details.amountInPaise),
      orderId: order.id,
      orderNumber: order.orderNumber,
      providerOrderId: payment.providerOrderId,
      returnUrl,
    };

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Fleet24 Checkout</title>
  <script nonce="${nonce}" src="https://checkout.razorpay.com/v1/checkout.js"></script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background-color: #0F172A; color: #F8FAFC; text-align: center; padding: 20px; }
    .card { background: #1E293B; border-radius: 16px; padding: 32px 24px; max-width: 400px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); }
    h2 { margin: 0 0 8px 0; color: #38BDF8; font-size: 22px; }
    p { color: #94A3B8; margin: 8px 0; font-size: 14px; }
    .amount { font-size: 32px; font-weight: 700; color: #F8FAFC; margin: 20px 0; }
    .btn { background: #0284C7; color: white; border: none; border-radius: 8px; padding: 14px 28px; font-size: 16px; font-weight: 600; cursor: pointer; width: 100%; transition: background 0.2s; }
    .btn:hover { background: #0369A1; }
  </style>
</head>
<body>
  <div class="card">
    <h2>Fleet24 Food Delivery</h2>
    <p>Order #${escapeHtml(order.orderNumber)}</p>
    <div class="amount">&#8377;${escapeHtml(order.totalPayable)}</div>
    <p>Opening Razorpay Checkout...</p>
    <button class="btn" id="payBtn" type="button">Pay &#8377;${escapeHtml(order.totalPayable)}</button>
  </div>

  <form id="redirectForm" method="POST" action="/api/v1/payments/redirect-callback" style="display:none;">
    <input type="hidden" name="orderId" value="${escapeHtml(order.id)}">
    <input type="hidden" name="returnUrl" value="${escapeHtml(returnUrl)}">
    <input type="hidden" name="razorpay_payment_id" id="f_payment_id">
    <input type="hidden" name="razorpay_order_id" id="f_order_id">
    <input type="hidden" name="razorpay_signature" id="f_signature">
  </form>

  <script nonce="${nonce}">
    var config = ${toInlineScriptLiteral(checkoutConfig)};
    function openRazorpay() {
      var options = {
        "key": config.key,
        "amount": config.amount,
        "currency": "INR",
        "name": "Fleet24",
        "description": "Order #" + config.orderNumber,
        "order_id": config.providerOrderId,
        "handler": function (response) {
          document.getElementById('f_payment_id').value = response.razorpay_payment_id;
          document.getElementById('f_order_id').value = response.razorpay_order_id;
          document.getElementById('f_signature').value = response.razorpay_signature;
          document.getElementById('redirectForm').submit();
        },
        "modal": {
          "ondismiss": function() {
            var sep = config.returnUrl.indexOf('?') === -1 ? '?' : '&';
            window.location.href = config.returnUrl + sep + "status=cancelled&orderId=" + encodeURIComponent(config.orderId);
          }
        },
        "theme": {
          "color": "#0284C7"
        }
      };
      var rzp = new Razorpay(options);
      rzp.open();
    }
    document.getElementById('payBtn').addEventListener('click', openRazorpay);
    window.addEventListener('load', openRazorpay);
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /**
   * 5. Intermediate Redirect Callback for Mobile Deep Link
   * Razorpay handler posts here, which issues HTTP 303 Redirect to returnUrl.
   * Only allowlisted return URLs are honoured; anything else falls back to the app deep link.
   */
  @Post('payments/redirect-callback')
  async redirectCallback(@Req() req: Request, @Res() res: Response) {
    const { orderId, returnUrl, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body || {};
    const baseTarget = this.resolveReturnUrl(returnUrl);
    const separator = baseTarget.includes('?') ? '&' : '?';
    const redirectUrl = `${baseTarget}${separator}orderId=${encodeURIComponent(orderId || '')}&razorpay_payment_id=${encodeURIComponent(razorpay_payment_id || '')}&razorpay_order_id=${encodeURIComponent(razorpay_order_id || '')}&razorpay_signature=${encodeURIComponent(razorpay_signature || '')}`;
    return res.redirect(303, redirectUrl);
  }

  private resolveReturnUrl(candidate: unknown): string {
    const allowlist = parsePaymentReturnAllowlist(
      this.configService.get<string>('PAYMENT_RETURN_URL_ALLOWLIST'),
    );
    const allowLocalDev = this.configService.get<string>('NODE_ENV') !== 'production';
    return resolvePaymentReturnUrl(candidate, allowlist, allowLocalDev);
  }
}

