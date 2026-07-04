import {useEffect, useState} from 'react';
import {Keyboard, KeyboardEvent, Platform} from 'react-native';

export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const onShow = (event: KeyboardEvent) => {
      // endCoordinates.height — высота клавиатуры от низа экрана
      setHeight(Math.max(0, event.endCoordinates.height));
    };
    const onHide = () => {
      setHeight(0);
    };

    const showEvents =
      Platform.OS === 'ios'
        ? (['keyboardWillShow', 'keyboardDidShow'] as const)
        : (['keyboardDidShow'] as const);
    const hideEvents =
      Platform.OS === 'ios'
        ? (['keyboardWillHide', 'keyboardDidHide'] as const)
        : (['keyboardDidHide'] as const);

    const subs = [
      ...showEvents.map(name => Keyboard.addListener(name, onShow)),
      ...hideEvents.map(name => Keyboard.addListener(name, onHide)),
    ];

    return () => {
      subs.forEach(sub => sub.remove());
    };
  }, []);

  return height;
}
