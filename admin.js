import { photoSource, categoryOf, compressPhoto } from "./shop-utils.js?v=20261004-manual";
import { generatedPhotoFor } from "./product-photos.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
  writeBatch,
  collection,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  doc,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";

import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";

import {
  firebaseConfig
} from "./firebase-config.js";


/* =========================
   Firebase
========================= */

const ADMIN_UID =
  "r8lFDyFoDTUffnwN6waBm0cMlHl1";


const app =
  initializeApp(
    firebaseConfig
  );


const db =
  getFirestore(app);


const auth =
  getAuth(app);


/* =========================
   共用工具
========================= */

const $ =
  id =>
    document.getElementById(id);


const money =
  n =>
    "NT$" +
    Number(n || 0)
      .toLocaleString("zh-TW");


const esc =
  s =>
    String(s ?? "")
      .replace(
        /[&<>"']/g,
        c => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        }[c])
      );


/* =========================
   預設店家資料
========================= */

const DEFAULT_STORE_SETTINGS = {

  storeName:
    "英姐蔬果商行",

  homeIntro:
    "每日新鮮蔬果，簡單選購、快速下單。",

  announcement:
    "歡迎光臨英姐蔬果商行",

  address:
    "",

  phone:
    "",

  hours:
    "",

  description:
    "每日提供新鮮蔬果，歡迎選購。"

};


/* =========================
   管理員登入
========================= */

$("loginBtn")
  .addEventListener(
    "click",
    async () => {

      const email =
        $("email")
          .value
          .trim();


      const password =
        $("password")
          .value;


      if (
        !email ||
        !password
      ) {

        $("msg").textContent =
          "請輸入 Email 和密碼";

        return;

      }


      $("msg").textContent =
        "登入中...";


      try {

        const result =
          await signInWithEmailAndPassword(
            auth,
            email,
            password
          );


        if (
          result.user.uid !==
          ADMIN_UID
        ) {

          await signOut(auth);


          $("msg").textContent =
            "此帳號沒有管理員權限";


          return;

        }


        $("msg").textContent =
          "";


      } catch (error) {

        console.error(
          "登入錯誤：",
          error
        );


        $("msg").textContent =
          "登入失敗，請確認 Email 或密碼";

      }

    }
  );


/* =========================
   Enter 登入
========================= */

$("password")
  .addEventListener(
    "keydown",
    event => {

      if (
        event.key ===
        "Enter"
      ) {

        $("loginBtn").click();

      }

    }
  );


/* =========================
   登出
========================= */

$("logoutBtn")
  .addEventListener(
    "click",
    async () => {

      try {

        if (!allowProductAction()) return;
        await signOut(auth);

      } catch (error) {

        console.error(
          "登出錯誤：",
          error
        );

      }

    }
  );


/* =========================
   監聽登入狀態
========================= */

onAuthStateChanged(
  auth,
  async user => {

    if (
      user &&
      user.uid === ADMIN_UID
    ) {

      $("login").hidden =
        true;


      $("panel").hidden =
        false;


      showAdminPage(
        "products"
      );


      try {

        await Promise.all([
          loadProducts(),
          loadOrders()
        ]);


      } catch (error) {

        console.error(
          "後台資料載入失敗：",
          error
        );

      }


    } else {

      $("login").hidden =
        false;


      $("panel").hidden =
        true;

    }

  }
);


/* =========================
   後台頁籤
========================= */

let productSection = "single";

function showAdminPage(page) {

  $("productsPanel").hidden =
    page !== "products";


  $("ordersPanel").hidden =
    page !== "orders";


  $("storeSettingsPanel").hidden =
    page !== "store";

}


$("pt")
  .addEventListener(
    "click",
    async () => {

      await openProductSection("single");

    }
  );


async function openProductSection(section) {
  if (!allowProductAction()) return;
  productSection = section;
  const bundle = section === "bundle";
  $("productSectionTitle").textContent = bundle ? "🛍️ 3包50元專區" : "🥬 單項商品";
  $("productSectionDescription").textContent = bundle
    ? "在這裡獨立新增專區商品。每包20元，任選混搭3包50元；可分別編輯照片與上下架。"
    : "獨立新增單項商品，自訂單位與價格；修改完成後一次儲存上架設定。";
  $("add").textContent = bundle ? "＋ 新增3包50元商品" : "＋ 新增單項商品";
  $("pt").setAttribute("aria-pressed", String(!bundle));
  $("bt").setAttribute("aria-pressed", String(bundle));
  $("productStatusMessage").textContent = "";
  showAdminPage("products");
  renderProductRows();
  await loadProducts();
}
$("bt").addEventListener("click", () => openProductSection("bundle"));

$("ot")
  .addEventListener(
    "click",
    async () => {

      showAdminPage(
        "orders"
      );


      await loadOrders();

    }
  );


$("st")
  .addEventListener(
    "click",
    async () => {

      showAdminPage(
        "store"
      );


      await loadStoreSettings();

    }
  );


/* =========================
   新增商品
========================= */

$("add")
  .addEventListener(
    "click",
    () => {

      if (!allowProductAction()) return;
      editProduct({

        name:
          "",

        bundle3for50: productSection === "bundle",

        unit:
          productSection === "bundle" ? "包" : "斤",

        price:
          productSection === "bundle" ? 20 : 0,

        emoji:
          "🥬",

        active:
          true,

        sort:
          999

      });

    }
  );


/* =========================
   讀取商品
========================= */

let productDrafts = [];
let bulkBusy = false;
let productsLoading = false;
const sectionProducts = () => productDrafts.filter(p => (p.bundle3for50 === true) === (productSection === "bundle"));
const dirtyProducts = () => sectionProducts().filter(p => p.priceText !== String(p.price ?? 0) || p.nextActive !== (p.active !== false));
function allowProductAction() {
  if (bulkBusy || productsLoading) return false;
  if (dirtyProducts().length) {
    alert("您有尚未儲存的改價／上架設定，請先按「儲存價格與上架設定」或「取消修改」。");
    return false;
  }
  return true;
}
window.addEventListener("beforeunload", event => {
  if (bulkBusy || dirtyProducts().length) { event.preventDefault(); event.returnValue = ""; }
});
function updateBulkStatus() {
  const count = dirtyProducts().length;
  $("bulkSave").disabled = bulkBusy || !count;
  $("bulkCancel").disabled = bulkBusy || !count;
  $("bulkSummary").textContent = count ? `${count} 項尚未儲存；按下儲存後才會更新前台。` : "價格與上架設定已同步。";
}
function renderProductRows() {
  $("products").innerHTML = sectionProducts().map(p => `
    <div class="bulk-product" data-id="${esc(p.id)}">
      <div><b>${esc(p.name)}</b><small>每${esc(p.unit || "份")}</small>${p.bundle3for50 === true ? '<small>任選3包50元</small>' : ""}</div>
      <label>價格（元）<input class="bulk-price" ${p.bundle3for50 === true ? "readonly" : ""} type="number" inputmode="decimal" min="0" max="999999" step="0.01" required value="${esc(p.priceText)}" aria-label="${esc(p.name)}價格"></label>
      <label class="bulk-active-label"><input class="bulk-active" type="checkbox" ${p.nextActive ? "checked" : ""}>上架</label>
      <div class="bulk-details"><button type="button" class="edit-product">詳細編輯</button><button type="button" class="delete-product">刪除</button></div>
    </div>`).join("") || '<div class="notice">尚無商品</div>';
  $("products").querySelectorAll(".bulk-product").forEach(row => {
    const p = productDrafts.find(item => item.id === row.dataset.id);
    row.querySelector(".bulk-price").addEventListener("input", event => { p.priceText = event.target.value; updateBulkStatus(); });
    row.querySelector(".bulk-active").addEventListener("change", event => { p.nextActive = event.target.checked; updateBulkStatus(); });
    row.querySelector(".edit-product").addEventListener("click", () => { if (allowProductAction()) editProduct(p); });
    row.querySelector(".delete-product").addEventListener("click", () => { if (allowProductAction()) deleteProduct(p.id); });
  });
  updateBulkStatus();
}
async function loadProducts() {
  if (bulkBusy || productsLoading || dirtyProducts().length) return;
  productsLoading = true;
  try {
    const snapshot = await getDocs(collection(db, "products"));
    productDrafts = snapshot.docs.map(item => ({...item.data(), id: item.id}));
    productDrafts.sort((a,b) => (a.sort ?? 999) - (b.sort ?? 999));
    productDrafts.forEach(p => { p.priceText = String(p.price ?? 0); p.nextActive = p.active !== false; });
    renderProductRows();
  } catch (error) {
    console.error("商品讀取失敗", error);
    $("productStatusMessage").textContent = "商品讀取失敗，請點商品管理重試。";
  } finally { productsLoading = false; }
}
$("bulkCancel").addEventListener("click", () => {
  if (bulkBusy || !confirm("取消這次尚未儲存的價格與上架修改？")) return;
  productDrafts.forEach(p => { p.priceText = String(p.price ?? 0); p.nextActive = p.active !== false; });
  renderProductRows();
});
$("bulkAll").addEventListener("click", () => {
  if (bulkBusy || productsLoading) return;
  sectionProducts().forEach(p => { p.nextActive = true; });
  renderProductRows();
});
$("bulkSave").addEventListener("click", async () => {
  if (bulkBusy || productsLoading || auth.currentUser?.uid !== ADMIN_UID) return;
  const changed = dirtyProducts();
  if (!changed.length) return;
  for (const p of changed) {
    const input = [...$("products").querySelectorAll(".bulk-product")].find(row => row.dataset.id === p.id).querySelector(".bulk-price");
    if (!p.priceText.trim() || !Number.isFinite(Number(p.priceText)) || !input.checkValidity()) {
      $("productStatusMessage").textContent = `請檢查「${p.name}」價格：須為 0～999999 元，最多兩位小數。`;
      input.reportValidity(); input.focus(); return;
    }
  }
  if (changed.length > 500) { alert("一次最多儲存 500 項，請減少本次修改數量。"); return; }
  bulkBusy = true;
  const controls = [...$("panel").querySelectorAll("button,input,select")];
  const previous = controls.map(el => el.disabled);
  controls.forEach(el => el.disabled = true);
  $("bulkSave").textContent = "儲存中…";
  $("productStatusMessage").textContent = "正在儲存，請保持網頁開啟…";
  try {
    const batch = writeBatch(db);
    changed.forEach(p => {
      const patch = {};
      if (p.priceText !== String(p.price ?? 0)) patch.price = Number(p.priceText);
      if (p.nextActive !== (p.active !== false)) patch.active = p.nextActive;
      batch.update(doc(db, "products", p.id), patch);
    });
    await batch.commit();
    changed.forEach(p => { p.price = Number(p.priceText); p.priceText = String(p.price); p.active = p.nextActive; });
    $("productStatusMessage").textContent = `已儲存 ${changed.length} 項！前台重新整理後即可看到最新價格與上架商品。`;
  } catch (error) {
    console.error("批次儲存失敗", error);
    $("productStatusMessage").textContent = "儲存失敗，本次修改未送出；輸入內容已保留，請確認網路及管理員權限後重試。";
  } finally {
    bulkBusy = false;
    controls.forEach((el,i) => el.disabled = previous[i]);
    $("bulkSave").textContent = "儲存價格與上架設定";
    updateBulkStatus();
  }
});


/* =========================
   編輯 / 新增商品
========================= */

let editingProduct = null;
let pendingPhoto = "";
let photoBusy = false;
let savingProduct = false;
let photoGeneration = 0;
function refreshPhotoPreview() {
  const ownPhoto = photoSource(pendingPhoto);
  const src = ownPhoto || generatedPhotoFor(editingProduct?.name);
  $("photoPreview").hidden = !src; $("photoEmpty").hidden = !!src;
  if(src) $("photoPreview").src = src; else $("photoPreview").removeAttribute("src");
  $("removeProductPhoto").disabled = !ownPhoto || photoBusy;
}
function editProduct(product) {
  editingProduct = product; pendingPhoto = photoSource(product.photo); photoGeneration++;
  const bundle = product.bundle3for50 === true;
  $("editorTitle").textContent = (product.id ? "編輯" : "新增") + (bundle ? "3包50元商品" : "單項商品");
  $("productName").value = product.name || "";
  $("productUnit").value = bundle ? "包" : product.unit || "斤";
  $("productUnit").readOnly = bundle;
  $("productPrice").value = bundle ? 20 : product.price ?? 0;
  $("productPrice").readOnly = bundle;
  $("productSort").value = product.sort ?? 999;
  $("productCategory").value = categoryOf(product);
  $("productActive").checked = product.active !== false;
  $("productKindNote").textContent = bundle ? "3包50元專區商品：固定每包20元，任選混搭3包50元。" : "單項商品：依設定的單價計費。專區商品請至「3包50元專區」新增。";
  $("productPhoto").value = ""; $("photoMessage").textContent = "";
  refreshPhotoPreview(); $("productEditor").showModal();
}
$("cancelProduct").addEventListener("click", () => { if(!photoBusy && !savingProduct) $("productEditor").close(); });
$("productEditor").addEventListener("cancel", event => { if(photoBusy || savingProduct) event.preventDefault(); });
$("productEditor").addEventListener("close", () => { photoGeneration++; });
$("productPhoto").addEventListener("change", async event => {
  const file = event.target.files[0]; if(!file) return;
  const generation = ++photoGeneration;
  photoBusy = true; $("saveProduct").disabled = true; $("cancelProduct").disabled = true;
  $("productPhoto").disabled = true; $("removeProductPhoto").disabled = true;
  $("photoMessage").textContent = "照片處理中…";
  try {
    const data = await compressPhoto(file);
    if(generation !== photoGeneration) return;
    pendingPhoto = data;
    $("photoMessage").textContent = "照片已準備好，請按儲存商品。";
  } catch(error) { $("photoMessage").textContent = error.message; }
  finally {
    photoBusy = false; $("saveProduct").disabled = false; $("cancelProduct").disabled = false;
    $("productPhoto").disabled = false; event.target.value = ""; refreshPhotoPreview();
  }
});
$("removeProductPhoto").addEventListener("click", () => {
  pendingPhoto = ""; refreshPhotoPreview(); $("photoMessage").textContent = "照片已移除，儲存商品後生效。";
});
$("productForm").addEventListener("submit", async event => {
  event.preventDefault(); if(photoBusy || savingProduct || !editingProduct) return;
  const price = Number($("productPrice").value), sort = Number($("productSort").value);
  const name = $("productName").value.trim(), unit = $("productUnit").value.trim();
  if(!name || !unit || !Number.isFinite(price) || price < 0 || !Number.isSafeInteger(sort) || sort < 0) {
    $("photoMessage").textContent = "請確認名稱、單位、價格及排序。"; return;
  }
  const bundle3for50 = editingProduct.bundle3for50 === true;
  if (bundle3for50 && (price !== 20 || !["包", "1包", "１包", "每包", "/包", "／包"].includes(unit.replace(/\s/g, "")))) {
    $("photoMessage").textContent = "專區商品須為每包20元，請重新開啟編輯後儲存。"; return;
  }
  const data = {name, unit, price, sort, bundle3for50, emoji: editingProduct.emoji || "🥬", active: $("productActive").checked, category: $("productCategory").value, photo: pendingPhoto};
  savingProduct = true;
  $("productForm").querySelectorAll("button,input,select").forEach(el => el.disabled = true);
  $("saveProduct").textContent = "儲存中…";
  try {
    if(editingProduct.id) await updateDoc(doc(db,"products",editingProduct.id), data);
    else await addDoc(collection(db,"products"), data);
    $("productEditor").close(); await loadProducts();
  } catch(error) {
    console.error("商品儲存失敗",error);
    $("photoMessage").textContent = "儲存失敗，照片仍保留在表單中。請確認網路及管理員寫入權限後重試。";
  } finally {
    savingProduct = false; $("productForm").querySelectorAll("button,input,select").forEach(el => el.disabled = false);
    $("saveProduct").textContent = "儲存商品"; refreshPhotoPreview();
  }
});


/* =========================
   刪除商品
========================= */

async function deleteProduct(id) {

  const ok =
    confirm(
      "確定要刪除這個商品嗎？\n\n刪除後無法復原。"
    );


  if (!ok) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "products",
        id
      )
    );


    await loadProducts();


  } catch (error) {

    console.error(
      "商品刪除失敗：",
      error
    );


    alert(
      "商品刪除失敗"
    );

  }

}


/* =========================
   訂單管理
========================= */

async function loadOrders() {

  try {

    $("orders").innerHTML =
      '<div class="notice">訂單載入中...</div>';


    const snapshot =
      await getDocs(
        query(
          collection(
            db,
            "orders"
          ),
          orderBy(
            "createdAt",
            "desc"
          )
        )
      );


    const orders =
      snapshot.docs
        .map(item => ({

          id:
            item.id,

          ...item.data()

        }));


    const pendingOrders =
      orders.filter(
        order =>
          !["completed", "cancelled"].includes(order.status)
      );


    const now =
      new Date();


    const todayOrders =
      orders.filter(order => {

        if (
          !order.createdAt ||
          typeof
            order.createdAt.toDate !==
            "function"
        ) {

          return false;

        }


        const date =
          order.createdAt
            .toDate();


        return (
          date.getFullYear() ===
            now.getFullYear() &&

          date.getMonth() ===
            now.getMonth() &&

          date.getDate() ===
            now.getDate()
        );

      });


    const todayTotal =
      todayOrders.reduce(
        (sum, order) =>
          sum +
          Number(
            order.total ||
            0
          ),
        0
      );


    const summaryHTML = `

      <div
        class="panel"
        style="margin-bottom:16px"
      >

        <h3>
          📊 今日訂單統計
        </h3>


        <div
          style="
            display:flex;
            gap:20px;
            flex-wrap:wrap;
            font-size:18px;
          "
        >

          <div>

            今日訂單：

            <b>
              ${todayOrders.length} 筆
            </b>

          </div>


          <div>

            今日營業額：

            <b>
              ${money(todayTotal)}
            </b>

          </div>


          <div>

            待處理：

            <b>
              ${pendingOrders.length} 筆
            </b>

          </div>

        </div>

      </div>

    `;


    if (!orders.length) {

      $("orders").innerHTML =
        summaryHTML +
        '<div class="notice">尚無訂單</div>';


      return;

    }


    const ordersHTML =
      orders
        .map(order => {

          const completed =
            order.status ===
            "completed";


          let timeText =
            "時間未記錄";


          if (
            order.createdAt &&
            typeof
              order.createdAt.toDate ===
              "function"
          ) {

            timeText =
              order.createdAt
                .toDate()
                .toLocaleString(
                  "zh-TW",
                  {
                    year:
                      "numeric",

                    month:
                      "2-digit",

                    day:
                      "2-digit",

                    hour:
                      "2-digit",

                    minute:
                      "2-digit"
                  }
                );

          }


          const itemsHTML =
            (order.items || [])
              .map(item => {

                const qty =
                  Number(
                    item.qty ||
                    0
                  );


                const price =
                  Number(
                    item.price ||
                    0
                  );


                return `

                  <div>

                    ${esc(
                      item.name ||
                      ""
                    )}

                    × ${qty}

                    ${
                      item.unit
                        ? " " +
                          esc(
                            item.unit
                          )
                        : ""
                    }

                    ｜

                    ${money(
                      price *
                      qty
                    )}

                  </div>

                `;

              })
              .join("");


          return `

            <div
              class="order"
              style="
                margin-bottom:15px;
                padding:15px;
                border:1px solid #ddd;
                border-radius:10px;
              "
            >

              <div
                style="
                  margin-bottom:8px;
                "
              >

                <b
                  style="
                    font-size:18px;
                  "
                >

                  ${
                    ({new:"🟠 訂單已收到",preparing:"🟡 備貨中",ready:"🟢 可取貨",completed:"✅ 已完成",cancelled:"⚪ 已取消"}[order.status] || "處理中")
                  }

                </b>

              </div>


              <div>
                🕐 ${esc(timeText)}
              </div>


              <br>


              <div>

                👤

                <b>
                  ${esc(
                    order.customerName ||
                    ""
                  )}
                </b>

                ｜

                📞

                ${esc(
                  order.customerPhone ||
                  ""
                )}

              </div>


              <br>


              <div>

                🥬
                <b>
                  商品明細
                </b>


                <div
                  style="
                    margin-top:6px;
                    line-height:1.8;
                  "
                >

                  ${
                    itemsHTML ||
                    "沒有商品資料"
                  }

                </div>

              </div>


              <br>


              <div>

                ${Number(order.discount) > 0 ? `<div style="margin-bottom:8px;color:#f0cc79">3包50元優惠：原價 ${money(order.subtotal)} − 折扣 ${money(order.discount)}</div>` : ""}
                💰 訂單金額：

                <b>
                  ${money(
                    order.total
                  )}
                </b>

              </div>


              <div
                style="
                  margin-top:6px;
                "
              >

                📝 備註：

                ${esc(
                  order.note ||
                  "無"
                )}

              </div>


              <br>


              <label>訂單進度 <select class="status-order" data-id="${esc(order.id)}" aria-label="訂單進度">
                ${Object.entries({new:"訂單已收到",preparing:"備貨中",ready:"可取貨",completed:"已完成",cancelled:"已取消"}).map(([value,label])=>`<option value="${value}" ${order.status===value?'selected':''}>${label}</option>`).join("")}
              </select></label>

              <button
                class="delete-order"
                data-id="${order.id}"
                type="button"
              >
                🗑 刪除
              </button>

            </div>

          `;

        })
        .join("");


    $("orders").innerHTML =
      summaryHTML +
      ordersHTML;


    document
      .querySelectorAll(
        ".status-order"
      )
      .forEach(button => {

        button.addEventListener(
          "change",
          () => {

            setOrderStatus(
              button.dataset.id,
              button.value
            );

          }
        );

      });


    document
      .querySelectorAll(
        ".delete-order"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            deleteOrder(
              button.dataset.id
            );

          }
        );

      });


  } catch (error) {

    console.error(
      "訂單讀取失敗：",
      error
    );


    $("orders").innerHTML =
      '<div class="notice">訂單讀取失敗</div>';

  }

}


/* =========================
   完成 / 恢復訂單
========================= */

async function setOrderStatus(
  id,
  status
) {

  try {

    await updateDoc(
      doc(
        db,
        "orders",
        id
      ),
      {
        status
      }
    );


    await loadOrders();


  } catch (error) {

    console.error(
      "訂單狀態更新失敗：",
      error
    );


    alert(
      "訂單狀態更新失敗"
    );

  }

}


/* =========================
   刪除訂單
========================= */

async function deleteOrder(id) {

  const ok =
    confirm(
      "確定要刪除這張訂單嗎？\n\n刪除後無法復原。"
    );


  if (!ok) {
    return;
  }


  try {

    await deleteDoc(
      doc(
        db,
        "orders",
        id
      )
    );


    await loadOrders();


  } catch (error) {

    console.error(
      "訂單刪除失敗：",
      error
    );


    alert(
      "訂單刪除失敗"
    );

  }

}


/* =========================
   店家資訊
========================= */

async function loadStoreSettings() {

  $("storeSettingsResult")
    .innerHTML =
      '<div class="notice">資料載入中...</div>';


  try {

    const ref =
      doc(
        db,
        "settings",
        "store"
      );


    const snapshot =
      await getDoc(ref);


    const data =
      snapshot.exists()
        ? {
            ...DEFAULT_STORE_SETTINGS,
            ...snapshot.data()
          }
        : DEFAULT_STORE_SETTINGS;


    $("settingStoreName").value =
      data.storeName || "";


    $("settingHomeIntro").value =
      data.homeIntro || "";


    $("settingAnnouncement").value =
      data.announcement || "";


    $("settingAddress").value =
      data.address || "";


    $("settingPhone").value =
      data.phone || "";


    $("settingHours").value =
      data.hours || "";


    $("settingDescription").value =
      data.description || "";


    $("storeSettingsResult")
      .innerHTML = "";


  } catch (error) {

    console.error(
      "店家資訊讀取失敗：",
      error
    );


    $("storeSettingsResult")
      .innerHTML = `
        <div class="notice">
          店家資訊讀取失敗
        </div>
      `;

  }

}


/* =========================
   儲存店家資訊
========================= */

$("saveStoreSettings")
  .addEventListener(
    "click",
    async () => {

      const storeName =
        $("settingStoreName")
          .value
          .trim();


      const homeIntro =
        $("settingHomeIntro")
          .value
          .trim();


      const announcement =
        $("settingAnnouncement")
          .value
          .trim();


      const address =
        $("settingAddress")
          .value
          .trim();


      const phone =
        $("settingPhone")
          .value
          .trim();


      const hours =
        $("settingHours")
          .value
          .trim();


      const description =
        $("settingDescription")
          .value
          .trim();


      if (!storeName) {

        alert(
          "請輸入店家名稱"
        );


        return;

      }


      $("saveStoreSettings")
        .disabled =
          true;


      $("saveStoreSettings")
        .textContent =
          "儲存中...";


      $("storeSettingsResult")
        .innerHTML = "";


      try {

        await setDoc(
          doc(
            db,
            "settings",
            "store"
          ),
          {

            storeName,

            homeIntro,

            announcement,

            address,

            phone,

            hours,

            description,

            updatedAt:
              new Date()

          },
          {
            merge:
              true
          }
        );


        $("storeSettingsResult")
          .innerHTML = `

            <div class="ok">

              <b>
                ✅ 店家資訊已儲存
              </b>

              <br>

              前台重新整理後即可顯示最新內容。

            </div>

          `;


      } catch (error) {

        console.error(
          "店家資訊儲存失敗：",
          error
        );


        $("storeSettingsResult")
          .innerHTML = `

            <div class="notice">

              ❌ 儲存失敗。

              <br>

              請確認網路連線及管理員的資料庫寫入權限。

            </div>

          `;


      } finally {

        $("saveStoreSettings")
          .disabled =
            false;


        $("saveStoreSettings")
          .textContent =
            "💾 儲存店家資訊";

      }

    }
  );
