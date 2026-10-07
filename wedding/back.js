/* 휴대폰 뒤로가기: 예식장 안에서 연 창(결과창, 게임, 안내 등)을 가장 위의 것부터 닫는다.
   창을 열 때 push로 기록을 하나 남기고, 화면의 닫기 버튼도 back()으로 닫아 기록과 화면이 어긋나지 않게 한다. */
(() => {
  'use strict';

  const stack = [];
  let afterBack = null;

  window.addEventListener('popstate', () => {
    // 여러 칸을 한 번에 돌아가도(history.go(-n)) 그 위의 창을 모두 닫는다
    const depth = history.state?.weddingDepth || 0;
    while (stack.length > depth) stack.pop().close();
    const next = afterBack;
    afterBack = null;
    next?.();
  });

  window.WEDDING_BACK = {
    push(name, close) {
      stack.push({name, close});
      history.pushState({weddingDepth: stack.length}, '');
    },
    top: () => stack[stack.length - 1]?.name,
    has: name => stack.some(layer => layer.name === name),
    depth: () => stack.length,
    // 맨 위 창 하나를 닫는다. then은 닫힌 다음에 할 일
    back(then) {
      if (!stack.length) { then?.(); return; }
      afterBack = then || null;
      history.back();
    },
    // name 창과 그 위의 창을 모두 닫는다
    closeTo(name, then) {
      const index = stack.map(layer => layer.name).lastIndexOf(name);
      if (index < 0) { then?.(); return; }
      afterBack = then || null;
      history.go(index - stack.length);
    }
  };
})();
