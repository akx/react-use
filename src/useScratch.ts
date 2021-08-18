import React, { cloneElement, FC, useEffect, useRef, useState } from 'react';
import { render } from 'react-universal-interface';
import useLatest from './useLatest';
import { off, on } from './misc/util';

export interface ScratchSensorParams {
  disabled?: boolean;
  onScratch?: (state: ScratchSensorState) => void;
  onScratchStart?: (state: ScratchSensorState) => void;
  onScratchEnd?: (state: ScratchSensorState) => void;
}

export type ScratchingState = {
  isScratching: true;
  start: number;
  end: number;
  x: number;
  y: number;
  dx: number;
  dy: number;
  docX: number;
  docY: number;
  elH: number;
  elW: number;
  elX: number;
  elY: number;
};
export type NotScratchingState = {
  isScratching: false;
};
export type ScratchSensorState = NotScratchingState | ScratchingState;

const useScratch = (
  params: ScratchSensorParams = {}
): [(el: HTMLElement | null) => void, ScratchSensorState] => {
  const { disabled } = params;
  const paramsRef = useLatest(params);
  const [state, setState] = useState<ScratchSensorState>({ isScratching: false });
  const refState = useRef<ScratchSensorState>(state);
  const refScratching = useRef<boolean>(false);
  const refAnimationFrame = useRef<any>(null);
  const [el, setEl] = useState<Element | null>(null);
  useEffect(() => {
    if (disabled) return;
    if (!el) return;

    const onMoveEvent = (docX: number, docY: number) => {
      cancelAnimationFrame(refAnimationFrame.current);
      refAnimationFrame.current = requestAnimationFrame(() => {
        const { left, top, width, height } = el.getBoundingClientRect();
        const elX = left + window.scrollX;
        const elY = top + window.scrollY;
        const x = docX - elX;
        const y = docY - elY;
        setState((oldState) => {
          if (!oldState.isScratching) {
            // This should never happen since `onMoveEvent` is only
            // bound after the state has been initialized scratchily.
            // However, we need to return something to make Typescript ungrumpy.
            return oldState;
          }
          const newState: ScratchSensorState = {
            ...oldState,
            dx: x - oldState.x,
            dy: y - oldState.y,
            elH: width,
            elW: height,
            end: Date.now(),
            isScratching: true,
          };
          refState.current = newState;
          paramsRef.current.onScratch?.(newState);
          return newState;
        });
      });
    };

    const onMouseMove = (event: React.MouseEvent) => {
      onMoveEvent(event.pageX, event.pageY);
    };

    const onTouchMove = (event: React.TouchEvent) => {
      onMoveEvent(event.changedTouches[0].pageX, event.changedTouches[0].pageY);
    };

    const stopScratching = () => {
      if (!refScratching.current) return;
      refScratching.current = false;
      // This is mildly against the types since you shouldn't be able to have
      // a scratch state with proper data while `isScratching` is false,
      // but an object like this will ever be emitted when finalizing the scratch.
      refState.current = { ...refState.current, isScratching: false };
      paramsRef.current.onScratchEnd?.(refState.current);
      setState({ isScratching: false });
      off(window, 'mousemove', onMouseMove);
      off(window, 'touchmove', onTouchMove);
      off(window, 'mouseup', stopScratching);
      off(window, 'touchend', stopScratching);
    };

    const startScratching = (docX: number, docY: number) => {
      if (!refScratching.current) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const elX = left + window.scrollX;
      const elY = top + window.scrollY;
      const x = docX - elX;
      const y = docY - elY;
      const time = Date.now();
      const newState: ScratchingState = {
        isScratching: true,
        start: time,
        end: time,
        docX,
        docY,
        x,
        y,
        dx: 0,
        dy: 0,
        elH: width,
        elW: height,
        elX,
        elY,
      };
      refState.current = newState;
      paramsRef.current.onScratchStart?.(newState);
      setState(newState);
      on(window, 'mousemove', onMouseMove);
      on(window, 'touchmove', onTouchMove);
      on(window, 'mouseup', stopScratching);
      on(window, 'touchend', stopScratching);
    };

    const onMouseDown = (event: React.MouseEvent) => {
      refScratching.current = true;
      startScratching(event.pageX, event.pageY);
    };

    const onTouchStart = (event: React.TouchEvent) => {
      refScratching.current = true;
      startScratching(event.changedTouches[0].pageX, event.changedTouches[0].pageY);
    };

    on(el, 'mousedown', onMouseDown);
    on(el, 'touchstart', onTouchStart);

    return () => {
      off(el, 'mousedown', onMouseDown);
      off(el, 'touchstart', onTouchStart);
      off(window, 'mousemove', onMouseMove);
      off(window, 'touchmove', onTouchMove);
      off(window, 'mouseup', stopScratching);
      off(window, 'touchend', stopScratching);

      if (refAnimationFrame.current) {
        cancelAnimationFrame(refAnimationFrame.current);
      }
      refAnimationFrame.current = null;

      refScratching.current = false;
      refState.current = { isScratching: false };
      setState(refState.current);
    };
  }, [el, disabled, paramsRef]);

  return [setEl, state];
};

export interface ScratchSensorProps extends ScratchSensorParams {
  children: (
    state: ScratchSensorState,
    ref: (el: HTMLElement | null) => void
  ) => React.ReactElement<any>;
}

export const ScratchSensor: FC<ScratchSensorProps> = (props) => {
  const { children, ...params } = props;
  const [ref, state] = useScratch(params);
  const element = render(props, state);
  return cloneElement(element, {
    ...element.props,
    ref: (el) => {
      if (element.props.ref) {
        if (typeof element.props.ref === 'object') element.props.ref.current = el;
        if (typeof element.props.ref === 'function') element.props.ref(el);
      }
      ref(el);
    },
  });
};

export default useScratch;
