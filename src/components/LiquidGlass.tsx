import React, {useMemo} from 'react';
import {StyleProp, StyleSheet, View, ViewStyle} from 'react-native';
import {useTheme} from '../theme';

interface Props {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: 'soft' | 'strong';
  /** Без внутренних отступов — для шапок и панелей */
  compact?: boolean;
}

const LiquidGlass: React.FC<Props> = ({
  children,
  style,
  intensity = 'strong',
  compact = false,
}) => {
  const {theme} = useTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        outer: {
          borderRadius: compact ? 0 : 28,
          overflow: 'hidden',
          borderWidth: compact ? 0 : 1,
          borderColor: theme.glassBorder,
          backgroundColor:
            intensity === 'strong' ? theme.glass : theme.glassHighlight,
          shadowColor: theme.mode === 'dark' ? '#000' : '#6B8BB5',
          shadowOffset: {width: 0, height: compact ? 0 : intensity === 'strong' ? 12 : 6},
          shadowOpacity: compact ? 0 : theme.mode === 'dark' ? 0.45 : 0.14,
          shadowRadius: compact ? 0 : intensity === 'strong' ? 28 : 16,
          elevation: compact ? 0 : 8,
        },
        shine: {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          backgroundColor: theme.glassHighlight,
          opacity: theme.mode === 'dark' ? 0.35 : 0.9,
        },
        inner: {
          padding: compact ? 0 : 20,
        },
      }),
    [theme, intensity, compact],
  );

  return (
    <View style={[styles.outer, style]}>
      <View style={styles.shine} />
      <View style={styles.inner}>{children}</View>
    </View>
  );
};

export default LiquidGlass;
