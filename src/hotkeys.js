const trigger = document.querySelector('[data-hotkeys-trigger]');
const card = document.querySelector('[data-hotkeys-card]');

if (trigger && card) {
  function openCard() {
    if (card.open) return;

    const weatherSwitcher = document.querySelector('[data-weather-switcher]');
    const themeSwitcher = document.querySelector('[data-theme-switcher]');
    if (weatherSwitcher?.open) weatherSwitcher.close();
    if (themeSwitcher?.open) themeSwitcher.close();

    card.show();
    trigger.setAttribute('aria-expanded', 'true');
  }

  function closeCard() {
    if (card.open) card.close();
    trigger.setAttribute('aria-expanded', 'false');
  }

  function toggleCard() {
    if (card.open) closeCard();
    else openCard();
  }

  trigger.addEventListener('click', toggleCard);
  card.addEventListener('close', () => {
    if (!card.open) trigger.setAttribute('aria-expanded', 'false');
  });

  document.addEventListener('keydown', (event) => {
    const target = event.target;
    const isTyping =
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target?.isContentEditable;

    if (
      !isTyping &&
      !event.altKey &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.repeat &&
      event.key === '?'
    ) {
      event.preventDefault();
      toggleCard();
      return;
    }

  });

  document.addEventListener('pointerdown', (event) => {
    if (
      card.open &&
      !card.contains(event.target) &&
      !trigger.contains(event.target)
    ) {
      closeCard();
    }
  });
}
