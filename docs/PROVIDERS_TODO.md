# SMS and payout providers

## Login OTP SMS

- [AuthController.requestOtp](../backend/src/auth/auth.controller.ts#L37) calls [AuthService.requestOtp](../backend/src/auth/auth.service.ts#L80), which stores an OTP challenge and passes the code to the SMS provider. [AuthModule](../backend/src/auth/auth.module.ts#L20) always binds [MockSmsProvider](../backend/src/auth/sms/mock-sms.provider.ts#L11), regardless of the existing `SMS_PROVIDER` setting. The mock logs the OTP outside production. In production it returns false, and the service still returns a success response.
- A Twilio Programmable Messaging implementation could use `SMS_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_MESSAGING_SERVICE_SID` or `TWILIO_FROM_NUMBER`. This fits the existing flow where Fleet24 generates the OTP. Provision an approved sender and template for the destination, bind the live provider through server configuration, and surface failed sends. [Twilio Messages API](https://www.twilio.com/docs/messaging/api/message-resource)

## Rider payouts and restaurant settlements

- [AdminFinanceService.processRiderPayout](../backend/src/admin/admin-finance.service.ts#L659) and [AdminFinanceService.processRestaurantSettlement](../backend/src/admin/admin-finance.service.ts#L1012) call [SandboxPayoutProvider](../backend/src/admin/admin-finance.service.ts#L49). The service instantiates this provider by default. It returns simulated success, and both workflows can record a completed disbursement in the ledger without a bank transfer.
- A RazorpayX implementation could use server-only `PAYOUT_PROVIDER=razorpayx`, `RAZORPAYX_KEY_ID`, `RAZORPAYX_KEY_SECRET`, `RAZORPAYX_ACCOUNT_NUMBER`, and `RAZORPAYX_WEBHOOK_SECRET`. It needs verified beneficiary fund-account IDs, live provider wiring, stable idempotency keys across retries, and webhook or polling reconciliation before marking a transfer complete. The existing Razorpay checkout settings configure customer payments. [RazorpayX Payouts API](https://razorpay.com/docs/api/x/payouts/create/bank-account/) · [Payout webhook events](https://axisbank-docs.razorpay.com/razorpayx/webhooks/payloads/)

The proposed variable names describe a future integration. This change adds no provider configuration or runtime behaviour.
