/** Toggles the upstream CPU workload so the two rendering threads can be compared. */
export function initJank(button: HTMLElement, result: HTMLElement): () => void {
  let interval: ReturnType<typeof setInterval> | null = null;
  function toggle(): void {
    if (interval === null) {
      interval = setInterval(() => {
        let number = 0;
        for (let i = 0; i < 10000000; i++) number += Math.random();
        result.textContent = String(number);
      }, 1000 / 60);
      button.textContent = "STOP JANK";
    } else {
      clearInterval(interval);
      interval = null;
      button.textContent = "START JANK";
      result.textContent = "";
    }
  }
  button.addEventListener("click", toggle);
  return () => {
    clearInterval(interval ?? undefined);
    button.removeEventListener("click", toggle);
  };
}
