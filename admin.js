import { photoSource, categoryOf, compressPhoto } from "./shop-utils.js";
import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";

import {
  getFirestore,
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

      showAdminPage(
        "products"
      );


      await loadProducts();

    }
  );


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

      editProduct({

        name:
          "新商品",

        unit:
          "斤",

        price:
          0,

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

async function loadProducts() {

  try {

    const snapshot =
      await getDocs(
        collection(
          db,
          "products"
        )
      );


    const products =
      snapshot.docs
        .map(item => ({

          id:
            item.id,

          ...item.data()

        }));


    products.sort(
      (a, b) =>
        (a.sort ?? 999) -
        (b.sort ?? 999)
    );


    if (!products.length) {

      $("products").innerHTML =
        '<div class="notice">尚無商品</div>';


      return;

    }


    $("products").innerHTML =
      products
        .map(product => `

          <div class="row product-admin-row">
            ${photoSource(product.photo) ? `<img class="admin-thumb" src="${esc(photoSource(product.photo))}" alt="${esc(product.name)}">` : `<div class="admin-thumb empty-thumb">🥬</div>`}

            <span>

              ${esc(
                product.emoji ||
                "🥬"
              )}

              <b>
                ${esc(
                  product.name ||
                  ""
                )}
              </b>

              ｜

              ${esc(
                product.unit ||
                ""
              )}

              ｜

              ${money(
                product.price
              )}

              ｜

              ${
                product.active ===
                false
                  ? "🔴 下架"
                  : "🟢 上架"
              }

            </span>


            <span>

              <button
                class="edit-product"
                data-id="${esc(product.id)}"
                type="button"
              >
                編輯
              </button>


              <button
                class="delete-product"
                data-id="${esc(product.id)}"
                type="button"
              >
                刪除
              </button>

            </span>

          </div>

        `)
        .join("");


    document
      .querySelectorAll(
        ".edit-product"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            const product =
              products.find(
                p =>
                  p.id ===
                  button.dataset.id
              );


            if (product) {

              editProduct(
                product
              );

            }

          }
        );

      });


    document
      .querySelectorAll(
        ".delete-product"
      )
      .forEach(button => {

        button.addEventListener(
          "click",
          () => {

            deleteProduct(
              button.dataset.id
            );

          }
        );

      });


  } catch (error) {

    console.error(
      "商品讀取失敗：",
      error
    );


    $("products").innerHTML =
      '<div class="notice">商品讀取失敗</div>';

  }

}


/* =========================
   編輯 / 新增商品
========================= */

let editingProduct = null;
let pendingPhoto = "";
let photoBusy = false;
let savingProduct = false;
let photoGeneration = 0;
function refreshPhotoPreview() {
  const src = photoSource(pendingPhoto);
  $("photoPreview").hidden = !src; $("photoEmpty").hidden = !!src;
  if(src) $("photoPreview").src = src; else $("photoPreview").removeAttribute("src");
  $("removeProductPhoto").disabled = !src || photoBusy;
}
function editProduct(product) {
  editingProduct = product; pendingPhoto = photoSource(product.photo); photoGeneration++;
  $("editorTitle").textContent = product.id ? "編輯商品" : "新增商品";
  $("productName").value = product.name || "";
  $("productUnit").value = product.unit || "斤";
  $("productPrice").value = product.price ?? 0;
  $("productSort").value = product.sort ?? 999;
  $("productCategory").value = categoryOf(product);
  $("productActive").checked = product.active !== false;
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
  const data = {name, unit, price, sort, emoji: editingProduct.emoji || "🥬", active: $("productActive").checked, category: $("productCategory").value, photo: pendingPhoto};
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
          order.status !==
          "completed"
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
                    completed
                      ? "🟢 已完成"
                      : "🟠 新訂單"
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


              <button
                class="status-order"
                data-id="${order.id}"
                data-status="${
                  completed
                    ? "new"
                    : "completed"
                }"
                type="button"
              >

                ${
                  completed
                    ? "↩️ 恢復新訂單"
                    : "✓ 完成訂單"
                }

              </button>


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
          "click",
          () => {

            setOrderStatus(
              button.dataset.id,
              button.dataset.status
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
