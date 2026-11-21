import { StyleSheet, TextStyle, ViewStyle, ImageStyle } from 'react-native';

/** DM Sans (shared with the customer app) on every screen; styles that set their own fontFamily keep it. */
export function appStyles<T extends Record<string, ViewStyle | TextStyle | ImageStyle>>(styles: T): T {
  const result = { ...styles };
  for (const key of Object.keys(styles) as (keyof T)[]) {
    const style = styles[key] as TextStyle;
    if ((style.fontSize !== undefined || style.fontWeight !== undefined) && !style.fontFamily) {
      const weight = style.fontWeight === 'bold' ? 700 : Number(style.fontWeight) || 400;
      result[key] = { ...style, fontFamily: weight >= 700 ? 'HomeBold' : weight >= 500 ? 'HomeMedium' : 'HomeRegular' } as T[keyof T];
    }
  }
  return StyleSheet.create(result);
}
