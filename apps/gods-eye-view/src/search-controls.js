export function installSearchControls({ input, button, onQuery }) {
  const locate = () => onQuery(input.value);
  const onKey = (event) => {
    if (event.key === "Enter" && !event.isComposing) {
      event.preventDefault();
      locate();
    }
  };
  button.addEventListener("click", locate);
  input.addEventListener("keydown", onKey);
  return () => {
    button.removeEventListener("click", locate);
    input.removeEventListener("keydown", onKey);
  };
}
