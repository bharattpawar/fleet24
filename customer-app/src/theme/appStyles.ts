import { StyleSheet, TextStyle, ViewStyle, ImageStyle } from 'react-native';

/** Use the same bundled typefaces on every customer screen, including sheets. */
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
