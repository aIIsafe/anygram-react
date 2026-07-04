import React, {useMemo} from 'react';
import {
  Platform,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import {BlurView} from '@react-native-community/blur';
import {useTheme} from '../theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: 'soft' | 'strong';
  /** Без внутренних отступов — для шапок и панелей */
  compact?: boolean;
  /** Нативный iOS/Android blur (UIVisualEffectView) */
  native?: boolean;
}

const LiquidGlass: React.FC<Props> = ({
  children,
  style,
  intensity = 'strong',
  compact = false,
  native = true,
}) => {
  const {theme} = useTheme();

  const blurType =
    theme.mode === 'dark'
      ? intensity === 'strong'
        ? 'chromeMaterialDark'
        : 'dark'
      : intensity === 'strong'
      ? 'chromeMaterialLight'
      : 'light';

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          borderRadius: compact ? 0 : 28,
          overflow: 'hidden',
          borderWidth: compact ? 0 : 1,
          borderColor: theme.glassBorder,
          backgroundColor: native ? 'transparent' : theme.glass,
          shadowColor: theme.mode === 'dark' ? '#000' : '#6B8BB5',
          shadowOffset: {
            width: 0,
            height: compact ? 0 : intensity === 'strong' ? 12 : 6,
          },
          shadowOpacity: compact ? 0 : theme.mode === 'dark' ? 0.45 : 0.14,
          shadowRadius: compact ? 0 : intensity === 'strong' ? 28 : 16,
          elevation: compact ? 0 : 8,
        },
        blur: {
          ...StyleSheet.absoluteFillObject,
        },
        tint: {
          ...StyleSheet.absoluteFillObject,
          backgroundColor:
            intensity === 'strong' ? theme.glass : theme.glassHighlight,
        },
        shine: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: theme.glassHighlight,
          opacity: theme.mode === 'dark' ? 0.45 : 0.95,
          zIndex: 2,
        },
        inner: {
          padding: compact ? 0 : 20,
          zIndex: 1,
        },
      }),
    [theme, intensity, compact, native],
  );

  return (
    <View style={[styles.outer, style]}>
      {native ? (
        <>
          <BlurView
            style={styles.blur}
            blurType={blurType}
            blurAmount={intensity === 'strong' ? 28 : 18}
            reducedTransparencyFallbackColor={theme.glass}
          />
          <View style={styles.tint} pointerEvents="none" />
        </>
      ) : null}
      <View style={styles.shine} pointerEvents="none" />
      <View style={styles.inner}>{children}</View>
    </View>
  );
};

export default LiquidGlass;
