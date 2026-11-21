/** Open/close a `ResponsiveListItem` and keep its header's aria state in sync. */
export function setAccordionOpen(item: Element, open: boolean) {
  item.classList.toggle('open', open);
  item
    .querySelector('.responsive-item-header')
    ?.setAttribute('aria-expanded', String(open));
}
