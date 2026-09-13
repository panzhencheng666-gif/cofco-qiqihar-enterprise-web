import { useEffect, useState, type RefObject } from "react";

/** Track the section actually at the reading edge, including manual/nested scrolling. */
export function useDocumentSection(
  form: RefObject<HTMLFormElement | null>,
  sectionKey: string,
) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const node = form.current;
        if (!node) return;
        const root = node.closest(".realtime-entry-dialog");
        const top = root ? root.getBoundingClientRect().top + 36 : 108;
        const sections = Array.from(node.querySelectorAll("fieldset"));
        let index = 0;
        let nearest = -Infinity;
        sections.forEach((section, i) => {
          const edge = section.getBoundingClientRect().top;
          if (edge <= top && edge > nearest + 1) {
            index = i;
            nearest = edge;
          }
        });
        setActive(index);
      });
    };
    document.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    update();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [form, sectionKey]);
  return active;
}
