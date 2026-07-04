import React, {useEffect, useRef} from 'react';
import {Animated, Easing, StyleSheet, View} from 'react-native';
import {useTheme} from '../theme';

const AuthBackground: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {theme} = useTheme();
  const drift1 = useRef(new Animated.Value(0)).current;
  const drift2 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(drift1, {
          toValue: 1,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift1, {
          toValue: 0,
          duration: 7000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(drift2, {
          toValue: 1,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(drift2, {
          toValue: 0,
          duration: 9000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    a.start();
    b.start();
    return () => {
      a.stop();
      b.stop();
    };
  }, [drift1, drift2]);

  const orb1Y = drift1.interpolate({inputRange: [0, 1], outputRange: [0, 24]});
  const orb2X = drift2.interpolate({inputRange: [0, 1], outputRange: [0, -20]});

  return (
    <View style={[styles.root, {backgroundColor: theme.background}]}>
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          {backgroundColor: theme.orb1, transform: [{translateY: orb1Y}]},
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          {backgroundColor: theme.orb2, transform: [{translateX: orb2X}]},
        ]}
      />
      <View style={[styles.orb, styles.orb3, {backgroundColor: theme.orb3}]} />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    overflow: 'hidden',
  },
  orb: {
    position: 'absolute',
    borderRadius: 999,
  },
  orb1: {
    width: 280,
    height: 280,
    top: -80,
    right: -60,
  },
  orb2: {
    width: 220,
    height: 220,
    bottom: 120,
    left: -70,
  },
  orb3: {
    width: 160,
    height: 160,
    top: '42%',
    right: -40,
  },
});

export default AuthBackground;
