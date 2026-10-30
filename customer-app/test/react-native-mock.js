module.exports = {
  Platform: {
    OS: 'ios',
    select: (obj) => obj.ios || obj.default,
  },
  StyleSheet: {
    create: (styles) => styles,
    absoluteFill: {},
  },
  Dimensions: {
    get: () => ({ width: 375, height: 812 }),
  },
  Animated: {
    Value: function () {
      return {
        interpolate: () => 0,
      };
    },
    timing: () => ({ start: (cb) => cb && cb() }),
    sequence: () => ({ start: (cb) => cb && cb() }),
    loop: () => ({ start: () => {}, stop: () => {} }),
  },
  Easing: {
    out: (e) => e,
    in: (e) => e,
    ease: (e) => e,
    cubic: (e) => e,
  },
  View: 'View',
  Text: 'Text',
  TouchableOpacity: 'TouchableOpacity',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Alert: {
    alert: () => {},
  },
  AppState: {
    addEventListener: () => ({ remove: () => {} }),
  },
};

