// <dialog closedby> は React 18 の型定義に未収録（属性自体はそのまま DOM に渡る）。
// import を置いてモジュール扱いにし、'react' の型を上書きではなく拡張する。
import 'react';

declare module 'react' {
  interface DialogHTMLAttributes<T> {
    closedby?: 'any' | 'closerequest' | 'none';
  }
}
