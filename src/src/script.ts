export {};
const navbar = document.querySelector<HTMLElement>('.navbar');

window.addEventListener('scroll', (): void => {
    if (!navbar) return;
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});