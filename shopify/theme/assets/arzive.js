document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll("[data-arzive-carousel]").forEach((root) => {
    const track = root.querySelector("[data-carousel-track]");
    if (!track) return;
    const step = () => Math.min(track.clientWidth * 0.7, 320);
    root.querySelector("[data-carousel-prev]")?.addEventListener("click", () => {
      track.scrollBy({ left: -step(), behavior: "smooth" });
    });
    root.querySelector("[data-carousel-next]")?.addEventListener("click", () => {
      track.scrollBy({ left: step(), behavior: "smooth" });
    });
  });
});
