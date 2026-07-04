import React, {useEffect, useRef} from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {useTheme} from '../theme';
import LiquidGlass from './LiquidGlass';

interface Props {
  compact?: boolean;
}

const ThemeToggle: React.FC<Props> = ({compact}) => {
  const {theme, isDark, toggleTheme} = useTheme();
  const slide = useRef(new Animated.Value(isDark ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(slide, {
      toValue: isDark ? 1 : 0,
      friction: 7,
      tension: 80,
      useNativeDriver: true,
    }).start();
  }, [isDark, slide]);

  const knobX = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 30],
  });

  const content = (
    <TouchableOpacity
      onPress={toggleTheme}
      activeOpacity={0.85}
      accessibilityLabel={isDark ? 'Светлая тема' : 'Тёмная тема'}>
      <View style={[styles.track, {backgroundColor: theme.surface}]}>
        <Text style={styles.iconLeft}>☀️</Text>
        <Text style={styles.iconRight}>🌙</Text>
        <Animated.View
          style={[
            styles.knob,
            {
              backgroundColor: theme.primary,
              transform: [{translateX: knobX}],
            },
          ]}
        />
      </View>
      {!compact && (
        <Text style={[styles.label, {color: theme.textSecondary}]}>
          {isDark ? 'Тёмная' : 'Светлая'}
        </Text>
      )}
    </TouchableOpacity>
  );

  if (compact) {
    return content;
  }

  return (
    <LiquidGlass intensity="soft" style={styles.glassWrap}>
      {content}
    </LiquidGlass>
  );
};

const styles = StyleSheet.create({
  glassWrap: {
    alignSelf: 'flex-end',
    marginBottom: 0,
  },
  track: {
    width: 64,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  iconLeft: {
    position: 'absolute',
    left: 8,
    fontSize: 14,
    opacity: 0.9,
  },
  iconRight: {
    position: 'absolute',
    right: 8,
    fontSize: 14,
    opacity: 0.9,
  },
  knob: {
    width: 28,
    height: 28,
    borderRadius: 14,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 11,
    textAlign: 'center',
    marginTop: 8,
    fontWeight: '500',
  },
});

export default ThemeToggle;
