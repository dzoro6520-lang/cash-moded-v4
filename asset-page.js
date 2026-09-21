(function () {
  const config = window.ASSET_PAGE;
  if (!config) return;
  const stored = Number(localStorage.getItem(config.storageKey));
  const value = Number.isFinite(stored) ? stored : config.defaultValue;
  document.querySelector("[data-asset-value]").textContent = value.toLocaleString("en-US", { style: "currency", currency: "USD" });
  document.querySelectorAll("[data-open-sheet]").forEach((button) => button.addEventListener("click", () => {
    const sheet = document.getElementById("assetSheet");
    sheet.querySelector("h2").textContent = `${button.dataset.openSheet} ${config.name}`;
    sheet.classList.add("open");
    document.body.style.overflow = "hidden";
  }));
  const close = () => { document.getElementById("assetSheet").classList.remove("open"); document.body.style.overflow = ""; };
  document.getElementById("assetSheet").addEventListener("click", (e) => { if (e.target.id === "assetSheet") close(); });
  document.getElementById("assetConfirm").addEventListener("click", () => {
    const amount = Number(document.getElementById("assetAmount").value);
    if (!Number.isFinite(amount) || amount <= 0) return;
    window.CashLoader?.show("Processing");
    setTimeout(() => { localStorage.setItem(config.storageKey, String(value + amount)); window.CashLoader?.hide(); close(); location.reload(); }, 900);
  });
})();

