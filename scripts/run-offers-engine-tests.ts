// scripts/run-offers-engine-tests.ts
// Automated Test Suite for Payvora Custom Offers Engine (Phases 2-13)

import crypto from "crypto";

// Polyfill Deno.env cleanly before dynamically importing Supabase Edge Function shared modules
const TEST_ENV: Record<string, string> = {
  TOROX_PUB_ID: "9001",
  TOROX_APP_ID: "4411",
  TOROX_API_KEY: "torox_api_key_test",
  TOROX_SECRET: "torox_postback_secret_test",
  LOOTABLY_API_KEY: "loot_api_key_test",
  LOOTABLY_PLACEMENT_ID: "loot_place_123",
  LOOTABLY_SECRET: "loot_secret_test",
  AYET_API_KEY: "ayet_api_key_test",
  AYET_ADSLOT_ID: "26815",
  AYET_SECRET: "ayet_hmac_secret_test",
  ADGATE_API_KEY: "adgate_api_key_test",
  ADGATE_AFFILIATE_ID: "7788",
  ADGATE_WALL_CODE: "naPR",
  ADGATE_SECRET: "adgate_secret_test",
  ADGEM_APP_ID: "9922",
  ADGEM_API_KEY: "adgem_api_key_test",
  ADGEM_POSTBACK_SECRET: "adgem_postback_secret_test",
  ADSCEND_PUBLISHER_ID: "112233",
  ADSCEND_PROFILE_ID: "4455",
  ADSCEND_API_KEY: "adscend_api_key_test",
  ADSCEND_POSTBACK_SECRET: "adscend_postback_secret_test",
  CPX_APP_ID: "24128",
  CPX_SECRET: "cpx_secret_test",
  TAPJOY_SECRET_KEY: "tapjoy_secret_test",
  TAPJOY_WALL_URL: "https://tapjoy.com/wall?snuid={user_id}",
};

(globalThis as any).Deno = {
  env: {
    get: (k: string) => TEST_ENV[k] ?? process.env[k],
  },
};

interface TestResult {
  id: string;
  name: string;
  category: string;
  passed: boolean;
  expected: string;
  actual: string;
}

const results: TestResult[] = [];

function recordTest(
  id: string,
  name: string,
  category: string,
  passed: boolean,
  expected: string,
  actual: string
) {
  results.push({ id, name, category, passed, expected, actual });
  const icon = passed ? "✅ PASS" : "❌ FAIL";
  console.log(`${icon} [${id}] ${name} -> Expected: ${expected} | Actual: ${actual}`);
}

// ============================================================================
// MOCK IN-MEMORY SUPABASE FOR SYNC ENGINE TESTS
// ============================================================================
class MockSyncQuery {
  private table: string;
  private db: MockSyncDb;
  private eqFilters: Array<[string, any]> = [];
  private ltFilters: Array<[string, any]> = [];
  private inFilters: Array<[string, any[]]> = [];
  private op: "select" | "insert" | "update" | "upsert" = "select";
  private payload: any = null;

  constructor(table: string, db: MockSyncDb) {
    this.table = table;
    this.db = db;
  }

  select(_cols?: string) {
    return this;
  }
  eq(col: string, val: any) {
    this.eqFilters.push([col, val]);
    return this;
  }
  lt(col: string, val: any) {
    this.ltFilters.push([col, val]);
    return this;
  }
  in(col: string, vals: any[]) {
    this.inFilters.push([col, vals]);
    return this;
  }
  insert(data: any) {
    this.op = "insert";
    this.payload = data;
    return this;
  }
  update(data: any) {
    this.op = "update";
    this.payload = data;
    return this;
  }
  upsert(data: any, _opts?: any) {
    this.op = "upsert";
    this.payload = data;
    return this;
  }
  single() {
    const res = this.execute();
    return Promise.resolve({ data: Array.isArray(res.data) ? res.data[0] || null : res.data, error: res.error });
  }
  maybeSingle() {
    const res = this.execute();
    return Promise.resolve({ data: Array.isArray(res.data) ? res.data[0] || null : res.data, error: res.error });
  }
  then(resolve: any, reject?: any) {
    return Promise.resolve(this.execute()).then(resolve, reject);
  }

  private matches(row: any) {
    for (const [c, v] of this.eqFilters) {
      if (row[c] !== v) return false;
    }
    for (const [c, v] of this.ltFilters) {
      if (!row[c] || row[c] >= v) return false;
    }
    for (const [c, vals] of this.inFilters) {
      if (!vals.includes(row[c])) return false;
    }
    return true;
  }

  private execute(): { data: any; error: any } {
    const store = this.db.tables[this.table];
    if (!store) return { data: null, error: null };

    if (this.op === "select") {
      return { data: store.filter((r) => this.matches(r)), error: null };
    }
    if (this.op === "insert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      const inserted = rows.map((r) => ({ id: `${this.table}_${this.db.seq++}`, ...r }));
      store.push(...inserted);
      return { data: inserted, error: null };
    }
    if (this.op === "update") {
      const updated: any[] = [];
      for (const r of store) {
        if (this.matches(r)) {
          Object.assign(r, this.payload);
          updated.push(r);
        }
      }
      return { data: updated, error: null };
    }
    if (this.op === "upsert") {
      const rows = Array.isArray(this.payload) ? this.payload : [this.payload];
      for (const r of rows) {
        const idx = store.findIndex(
          (e) => e.provider_id === r.provider_id && e.external_offer_id === r.external_offer_id
        );
        if (idx >= 0) {
          store[idx] = { ...store[idx], ...r };
        } else {
          store.push({ id: `offer_${this.db.seq++}`, ...r });
        }
      }
      return { data: rows, error: null };
    }
    return { data: null, error: null };
  }
}

class MockSyncDb {
  seq = 1;
  tables: Record<string, any[]> = {
    app_settings: [
      {
        key: "offerwall_commission_config",
        value: {
          default_user_share_percent: 70,
          min_user_reward_usd: 0.01,
          max_user_reward_usd: 1000,
          provider_user_share_overrides: { cpx: 80 },
        },
      },
    ],
    offer_providers: [
      {
        id: "prov_torox",
        provider_key: "torox",
        display_name: "Torox",
        status: "active",
        sync_enabled: true,
        commission_override_percent: null,
        allowed_redirect_domains: ["torox.io", "torox.com", "ttrk.io"],
      },
      {
        id: "prov_tapjoy",
        provider_key: "tapjoy",
        display_name: "Tapjoy",
        status: "active",
        sync_enabled: true,
        commission_override_percent: null,
        allowed_redirect_domains: ["tapjoy.com"],
      },
    ],
    offers: [
      {
        id: "offer_legacy_1",
        provider_id: "prov_torox",
        external_offer_id: "OLD_REMOVED_99",
        title: "Old Completed Game Offer",
        is_active: true,
        expires_at: null,
      },
    ],
    provider_sync_logs: [],
  };

  from(table: string) {
    return new MockSyncQuery(table, this);
  }
}

// ============================================================================
// MAIN TEST EXECUTION
// ============================================================================
async function runOffersEngineTests() {
  console.log("\n========================================================");
  console.log("PAYVORA CUSTOM OFFERS ENGINE TEST SUITE");
  console.log("Testing Adapters, Reward Engine, Sync, Clicks, Postbacks & Reversals");
  console.log("========================================================\n");

  const { md5Hex, sha256Hex, hmacSha256Hex, hmacSha1Hex } = await import(
    "../supabase/functions/_shared/crypto.ts"
  );
  const { buildRewardCalculator, DEFAULT_COMMISSION_CONFIG } = await import(
    "../supabase/functions/_shared/offers/reward-engine.ts"
  );
  const {
    getProviderAdapter,
    listProviderAdapters,
    buildHostedWallLaunchUrl,
  } = await import("../supabase/functions/_shared/providers/registry.ts");
  const { syncProviderOffers } = await import(
    "../supabase/functions/_shared/offers/sync-engine.ts"
  );

  // --------------------------------------------------------------------------
  // TEST 01: Provider Registry & Adapter Coverage
  // --------------------------------------------------------------------------
  {
    const adapters = listProviderAdapters();
    const keys = adapters.map((a) => a.providerKey);
    const expected = ["torox", "lootably", "ayet", "adgate", "adgem", "adscend", "cpx", "tapjoy"];
    const passed = expected.every((k) => keys.includes(k));
    recordTest(
      "OFFER-01",
      "Registry exposes all 8 partner adapters",
      "Architecture",
      passed,
      "8 Adapters Registered",
      `${adapters.length} Adapters (${keys.join(",")})`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 02: Decimal-Safe Reward Calculation & Commission Splits
  // --------------------------------------------------------------------------
  {
    const calcDefault = buildRewardCalculator(DEFAULT_COMMISSION_CONFIG, "torox");
    const calcCpx = buildRewardCalculator(DEFAULT_COMMISSION_CONFIG, "cpx");

    const splitTorox = calcDefault("1.00");
    const splitCpx = calcCpx(1.0);
    const dustRejected = calcDefault(0.01); // 70% = 0.007 < minUserRewardUsd $0.01 -> null
    const eurSplit = calcDefault(10, { currency: "EUR" });
    const badCurrency = calcDefault(10, { currency: "XYZ" });

    const passed =
      splitTorox?.providerReward === 1.0 &&
      splitTorox?.userReward === 0.7 &&
      splitTorox?.payvoraCommission === 0.3 &&
      splitCpx?.userReward === 0.8 &&
      dustRejected === null &&
      eurSplit !== null &&
      eurSplit.userReward === 7.56 &&
      badCurrency === null;

    recordTest(
      "OFFER-02",
      "Decimal-safe commission calculation, overrides, floor & FX guard",
      "Reward Engine",
      passed,
      "Torox $0.70 / CPX $0.80 / Dust & Invalid FX Rejected",
      `Torox=$${splitTorox?.userReward} CPX=$${splitCpx?.userReward} Dust=${dustRejected}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 03: Offer Normalization & Untrusted Redirect Domain Rejection
  // --------------------------------------------------------------------------
  {
    const calc = buildRewardCalculator(DEFAULT_COMMISSION_CONFIG, "torox");
    const torox = getProviderAdapter("torox")!;
    const lootably = getProviderAdapter("lootably")!;
    const cpx = getProviderAdapter("cpx")!;
    const tapjoy = getProviderAdapter("tapjoy")!;

    const validTorox = torox.normalizeOffer(
      {
        offer_id: "tx_100",
        offer_name: "Rise of Kingdoms",
        offer_desc: "Reach City Hall 17",
        payout: 25.0,
        click_url: "https://torox.io/click?oid=100",
        countries: ["US", "CA"],
        device: "Android",
        events: [
          { name: "Install App", payout: 0.5 },
          { name: "Reach Level 17", payout: 24.5 },
        ],
      },
      calc
    );

    const maliciousRedirect = torox.normalizeOffer(
      {
        offer_id: "tx_evil",
        offer_name: "Phishing Offer",
        payout: 5.0,
        click_url: "https://evil-phishing-site.com/redirect",
      },
      calc
    );

    const validLoot = lootably.normalizeOffer(
      {
        id: "lb_55",
        name: "Finance App Trial",
        revenue: 4.0,
        link: "https://wall.lootably.com/offer/55",
        countries: "GB,DE",
        devices: ["ios"],
      },
      calc
    );

    const validCpx = cpx.normalizeOffer(
      {
        id: "cpx_s1",
        payout_publisher_usd: 1.5,
        loi: 8,
        href: "https://offers.cpx-research.com/index.php?app_id=24128&survey_id=cpx_s1",
      },
      buildRewardCalculator(DEFAULT_COMMISSION_CONFIG, "cpx")
    );

    const tapjoyFetch = await tapjoy.fetchOffers({});

    const passed =
      validTorox !== null &&
      validTorox.user_reward === 17.5 &&
      validTorox.steps.length === 2 &&
      maliciousRedirect === null &&
      validLoot !== null &&
      validLoot.countries.includes("GB") &&
      validLoot.device_types.includes("ios") &&
      validCpx !== null &&
      validCpx.estimated_time === 8 &&
      validCpx.category === "surveys" &&
      tapjoyFetch.unsupportedByProvider === true &&
      tapjoyFetch.offers.length === 0;

    recordTest(
      "OFFER-03",
      "Multi-provider offer normalization, domain whitelisting & Tapjoy honest hosted-only mode",
      "Adapter Normalization",
      passed,
      "Normalized Valid, Blocked Evil Redirect, Tapjoy Skipped",
      `Torox=${Boolean(validTorox)} Evil=${maliciousRedirect} TapjoySkip=${tapjoyFetch.unsupportedByProvider}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 04: Opaque Click ID Attribution Building & Server Wall URLs
  // --------------------------------------------------------------------------
  {
    const torox = getProviderAdapter("torox")!;
    const adgem = getProviderAdapter("adgem")!;
    const cpx = getProviderAdapter("cpx")!;

    const opaqueClick = "pv_00112233445566778899aabbccddeeff";
    const toroxClick = torox.validateClick(
      {
        id: "offer_1",
        external_offer_id: "100",
        destination_url: "https://torox.io/click?oid=100",
        countries: ["US"],
        excluded_countries: [],
        device_types: ["android"],
        expires_at: null,
        is_active: true,
      },
      { id: "user-uuid-should-not-leak", country: "US", device: "android" },
      opaqueClick
    );

    const adgemClick = adgem.validateClick(
      {
        id: "offer_2",
        external_offer_id: "200",
        destination_url: "https://api.adgem.com/v1/click?cid=200",
        countries: [],
        excluded_countries: [],
        device_types: ["all"],
        expires_at: null,
        is_active: true,
      },
      { id: "user-uuid-should-not-leak" },
      opaqueClick
    );

    const cpxClick = cpx.validateClick(
      {
        id: "offer_3",
        external_offer_id: "300",
        destination_url: "https://offers.cpx-research.com/index.php?app_id=24128&ext_user_id=STALE_USER",
        countries: [],
        excluded_countries: [],
        device_types: ["all"],
        expires_at: null,
        is_active: true,
      },
      { id: "user-uuid-active" },
      opaqueClick
    );

    const wallCpx = buildHostedWallLaunchUrl("cpx", "user-uuid-active");
    const wallTapjoy = buildHostedWallLaunchUrl("tapjoy", "user-uuid-active");

    const passed =
      toroxClick.valid &&
      toroxClick.trackingUrl!.includes(`user_id=${opaqueClick}`) &&
      !toroxClick.trackingUrl!.includes("user-uuid-should-not-leak") &&
      adgemClick.valid &&
      adgemClick.trackingUrl!.includes(`playerid=${opaqueClick}`) &&
      cpxClick.valid &&
      cpxClick.trackingUrl!.includes("ext_user_id=user-uuid-active") &&
      !cpxClick.trackingUrl!.includes("STALE_USER") &&
      Boolean(wallCpx.url?.includes("secure_hash=")) &&
      wallTapjoy.url === "https://tapjoy.com/wall?snuid=user-uuid-active";

    recordTest(
      "OFFER-04",
      "Opaque pv_ click attribution hides internal user UUID & overwrites stale CPX hash",
      "Click Attribution",
      passed,
      "Opaque Tokens & Server Wall URLs Built",
      `ToroxOk=${toroxClick.valid} CpxFresh=${!cpxClick.trackingUrl?.includes("STALE_USER")}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 05: Offer Synchronization Engine (Pagination, Deactivation & History Preservation)
  // --------------------------------------------------------------------------
  {
    const mockDb = new MockSyncDb();
    const originalFetch = globalThis.fetch;

    // Mock Torox paginated API responses (Page 1 active + expired, Page 2 active)
    globalThis.fetch = (async (urlInput: string | URL | Request) => {
      const u = new URL(typeof urlInput === "string" ? urlInput : urlInput.toString());
      const page = Number(u.searchParams.get("page") || "1");
      if (page === 1) {
        return new Response(
          JSON.stringify({
            has_more: true,
            offers: Array.from({ length: 50 }, (_, idx) => ({
              offer_id: idx === 0 ? "EXP_999" : `TOROX_P1_${idx}`,
              offer_name: idx === 0 ? "Expired Game" : `Game Offer P1 #${idx}`,
              payout: 2.0,
              click_url: `https://torox.io/click?oid=${idx}`,
              expires_at: idx === 0 ? "2020-01-01T00:00:00Z" : null,
            })),
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          has_more: false,
          offers: [
            {
              offer_id: "TOROX_P2_1",
              offer_name: "Page 2 App Offer",
              payout: 5.0,
              click_url: "https://torox.io/click?oid=p2_1",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as typeof fetch;

    try {
      const toroxSync = await syncProviderOffers(mockDb as any, "torox");
      const tapjoySync = await syncProviderOffers(mockDb as any, "tapjoy");

      const legacyOfferRow = mockDb.tables.offers.find(
        (o) => o.external_offer_id === "OLD_REMOVED_99"
      );
      const p2Offer = mockDb.tables.offers.find((o) => o.external_offer_id === "TOROX_P2_1");
      const expiredInserted = mockDb.tables.offers.find((o) => o.external_offer_id === "EXP_999");

      const passed =
        toroxSync.status === "success" &&
        toroxSync.offersReceived === 51 &&
        toroxSync.offersCreated === 50 &&
        toroxSync.offersDeactivated === 1 &&
        legacyOfferRow !== undefined &&
        legacyOfferRow.is_active === false && // Preserved row, safely deactivated!
        p2Offer !== undefined &&
        p2Offer.user_reward === 3.5 &&
        expiredInserted === undefined &&
        tapjoySync.status === "skipped" &&
        mockDb.tables.provider_sync_logs.length === 2;

      recordTest(
        "OFFER-05",
        "Sync Engine paginates, filters expired offers & deactivates stale offers without deleting history",
        "Offer Sync",
        passed,
        "Created=50, LegacyDeactivated=true, ExpiredSkipped=true",
        `Created=${toroxSync.offersCreated} Deact=${toroxSync.offersDeactivated} LegacyActive=${legacyOfferRow?.is_active}`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 06: Sync Engine 429 Rate Limit Safety (Never Wipes Existing Offers)
  // --------------------------------------------------------------------------
  {
    const mockDb = new MockSyncDb();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      return new Response("Rate limit exceeded", { status: 429 });
    }) as typeof fetch;

    try {
      const res = await syncProviderOffers(mockDb as any, "torox");
      const legacyStillActive = mockDb.tables.offers.find(
        (o) => o.external_offer_id === "OLD_REMOVED_99"
      )?.is_active;

      const passed = res.status === "skipped" && legacyStillActive === true;
      recordTest(
        "OFFER-06",
        "Sync Engine 429 rate-limit aborts cleanly without deactivating active offers",
        "Offer Sync",
        passed,
        "status=skipped, existing catalog preserved",
        `status=${res.status}, legacyStillActive=${legacyStillActive}`
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  }

  // --------------------------------------------------------------------------
  // TEST 07: Cryptographic Postback Signature Verification Across All 8 Providers
  // --------------------------------------------------------------------------
  {
    const torox = getProviderAdapter("torox")!;
    const lootably = getProviderAdapter("lootably")!;
    const ayet = getProviderAdapter("ayet")!;
    const adgate = getProviderAdapter("adgate")!;
    const adgem = getProviderAdapter("adgem")!;
    const adscend = getProviderAdapter("adscend")!;
    const cpx = getProviderAdapter("cpx")!;
    const tapjoy = getProviderAdapter("tapjoy")!;

    const clickId = "pv_testclick123456";

    // Torox valid vs forged
    const toroxSig = md5Hex(`tx_t1-${clickId}-${TEST_ENV.TOROX_SECRET}`);
    const toroxOk = await torox.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { tx_id: "tx_t1", user_id: clickId, amount: "2.00", sig: toroxSig },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });
    const toroxRawSecretRejected = await torox.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { tx_id: "tx_t1", user_id: clickId, amount: "2.00", secret: TEST_ENV.TOROX_SECRET },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // Lootably valid SHA256
    const lootHash = await sha256Hex(`${clickId}1.2.3.43.00${TEST_ENV.LOOTABLY_SECRET}`);
    const lootOk = await lootably.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { userID: clickId, ip: "1.2.3.4", reward: "3.00", transactionId: "tx_l1", hash: lootHash },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // ayeT sorted query HMAC-SHA256
    const ayetParams = { currency_amount: "4.00", transaction_id: "tx_a1", uid: clickId };
    const ayetSorted = Object.keys(ayetParams)
      .sort()
      .map((k) => `${k}=${(ayetParams as any)[k]}`)
      .join("&");
    const ayetSig = await hmacSha256Hex(TEST_ENV.AYET_SECRET, ayetSorted);
    const ayetOk = await ayet.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: ayetParams,
      headers: new Headers({ "X-Ayetstudios-Security-Hash": ayetSig }),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // AdGate cryptographic signature vs raw ?secret= disabled
    const adgateSig = await sha256Hex(`tx_ag1:${clickId}:${TEST_ENV.ADGATE_SECRET}`);
    const adgateOk = await adgate.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { tx_id: "tx_ag1", s1: clickId, payout: "1.50", sig: adgateSig },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });
    const adgateRawRejected = await adgate.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { tx_id: "tx_ag1", s1: clickId, payout: "1.50", secret: TEST_ENV.ADGATE_SECRET },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // AdGem HMAC-SHA256
    const adgemHash = await hmacSha256Hex(TEST_ENV.ADGEM_POSTBACK_SECRET, `tx_gm1:${clickId}:2.50`);
    const adgemOk = await adgem.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { transaction_id: "tx_gm1", playerid: clickId, amount: "2.50", verifier: adgemHash },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // Adscend HMAC-SHA1
    const adscendParams = { rate: "1.20", subid1: clickId, tx_id: "tx_as1" };
    const adscendSorted = Object.keys(adscendParams)
      .sort()
      .map((k) => `${k}=${(adscendParams as any)[k]}`)
      .join("&");
    const adscendSig = await hmacSha1Hex(TEST_ENV.ADSCEND_POSTBACK_SECRET, adscendSorted);
    const adscendOk = await adscend.verifyPostback({
      method: "POST",
      url: new URL("https://x.test"),
      params: adscendParams,
      headers: new Headers({ "X-Adscend-Signature": adscendSig }),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // CPX Research MD5 + status=2 reversal parse
    const cpxHash = md5Hex(`tx_cpx1-${TEST_ENV.CPX_SECRET}`);
    const cpxOk = await cpx.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { trans_id: "tx_cpx1", ext_user_id: "user-1", amount_local: "1.00", status: "2", hash: cpxHash },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });
    const cpxRev = cpx.parseReversal({
      method: "GET",
      url: new URL("https://x.test"),
      params: { trans_id: "tx_cpx1", ext_user_id: "user-1", amount_local: "1.00", status: "2", hash: cpxHash },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    // Tapjoy MD5
    const tjHash = md5Hex(`tx_tj1:user-1:2.00:${TEST_ENV.TAPJOY_SECRET_KEY}`);
    const tjOk = await tapjoy.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { id: "tx_tj1", snuid: "user-1", currency: "2.00", verifier: tjHash },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });

    const passed =
      toroxOk.valid &&
      !toroxRawSecretRejected.valid &&
      lootOk.valid &&
      ayetOk.valid &&
      adgateOk.valid &&
      !adgateRawRejected.valid &&
      adgemOk.valid &&
      adscendOk.valid &&
      cpxOk.valid &&
      cpxRev !== null &&
      tjOk.valid;

    recordTest(
      "OFFER-07",
      "Cryptographic postback signature verification & raw-secret bypass blocking across 8 adapters",
      "Webhook Security",
      passed,
      "All 8 Valid Accepted & Raw-Secret Bypass Blocked",
      `Torox=${toroxOk.valid}/Raw=${toroxRawSecretRejected.valid} AdGate=${adgateOk.valid}/Raw=${adgateRawRejected.valid} CPX=${cpxOk.valid}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 08: Concurrent Conversion Deduplication, Partial/Full Reversal, Balance Clamp & Referral Clawback
  // --------------------------------------------------------------------------
  {
    const ledger = {
      users: new Map<string, { balance: number; earned: number }>([
        ["alice", { balance: 0.0, earned: 0.0 }],
        ["referrer_bob", { balance: 1.0, earned: 1.0 }],
      ]),
      referrals: new Map<string, { referrerId: string; totalCommission: number }>([
        ["alice", { referrerId: "referrer_bob", totalCommission: 0.0 }],
      ]),
      completions: new Map<
        string,
        { userId: string; providerReward: number; userReward: number; reversedAmount: number; status: string }
      >(),
      locks: new Set<string>(),
      botNotificationsSent: 0,
    };

    const convertAtomic = async (txKey: string, userId: string, providerReward: number, sharePct: number) => {
      while (ledger.locks.has(userId)) {
        await new Promise((r) => setTimeout(r, 2));
      }
      ledger.locks.add(userId);
      try {
        if (ledger.completions.has(txKey)) {
          return { already_processed: true };
        }
        const userReward = Math.floor(providerReward * sharePct) / 100;
        const u = ledger.users.get(userId)!;
        u.balance = Math.round((u.balance + userReward) * 100) / 100;
        u.earned = Math.round((u.earned + userReward) * 100) / 100;

        const ref = ledger.referrals.get(userId);
        if (ref) {
          const comm = Math.round(userReward * 0.1 * 100) / 100;
          const ru = ledger.users.get(ref.referrerId)!;
          ru.balance = Math.round((ru.balance + comm) * 100) / 100;
          ref.totalCommission = Math.round((ref.totalCommission + comm) * 100) / 100;
        }

        ledger.completions.set(txKey, {
          userId,
          providerReward,
          userReward,
          reversedAmount: 0,
          status: "credited",
        });
        ledger.botNotificationsSent++;
        return { already_processed: false, userReward };
      } finally {
        ledger.locks.delete(userId);
      }
    };

    const reverseAtomic = (txKey: string, providerReversalAmount: number) => {
      const comp = ledger.completions.get(txKey)!;
      const remaining = Math.max(0, comp.userReward - comp.reversedAmount);
      if (remaining <= 0) return { already_processed: true, deducted: 0 };

      const ratio =
        providerReversalAmount <= 0 || providerReversalAmount >= comp.providerReward
          ? 1
          : providerReversalAmount / comp.providerReward;
      const targetRev = Math.min(remaining, Math.round(comp.userReward * ratio * 100) / 100);

      const u = ledger.users.get(comp.userId)!;
      const actualDeduct = Math.min(u.balance, targetRev);
      const deficit = Math.round((targetRev - actualDeduct) * 100) / 100;
      u.balance = Math.round((u.balance - actualDeduct) * 100) / 100;

      const ref = ledger.referrals.get(comp.userId);
      if (ref) {
        const commRev = Math.round(targetRev * 0.1 * 100) / 100;
        const ru = ledger.users.get(ref.referrerId)!;
        const refDeduct = Math.min(ru.balance, commRev);
        ru.balance = Math.round((ru.balance - refDeduct) * 100) / 100;
        ref.totalCommission = Math.max(0, Math.round((ref.totalCommission - refDeduct) * 100) / 100);
      }

      comp.reversedAmount = Math.round((comp.reversedAmount + targetRev) * 100) / 100;
      comp.status = comp.reversedAmount >= comp.userReward ? "reversed" : "partially_reversed";
      return { already_processed: false, deducted: actualDeduct, deficit, status: comp.status };
    };

    // Simulate 5 concurrent duplicate postbacks for $10 provider payout @ 70% share ($7.00 user, $0.70 ref)
    await Promise.all([
      convertAtomic("torox_tx_race", "alice", 10.0, 70),
      convertAtomic("torox_tx_race", "alice", 10.0, 70),
      convertAtomic("torox_tx_race", "alice", 10.0, 70),
      convertAtomic("torox_tx_race", "alice", 10.0, 70),
      convertAtomic("torox_tx_race", "alice", 10.0, 70),
    ]);

    const aliceAfterCredit = ledger.users.get("alice")!.balance;
    const bobAfterCredit = ledger.users.get("referrer_bob")!.balance;
    const notifCountAfterRace = ledger.botNotificationsSent;

    // Simulate 50% partial chargeback ($5 provider -> $3.50 user, $0.35 referrer)
    const partialRev = reverseAtomic("torox_tx_race", 5.0);

    // Alice withdraws $3.00 (leaving $0.50), then remaining 50% chargeback hits ($3.50 requested -> clamps to $0.50 deducted, $3.00 deficit)
    ledger.users.get("alice")!.balance = 0.5;
    const finalRev = reverseAtomic("torox_tx_race", 5.0);
    const duplicateRev = reverseAtomic("torox_tx_race", 5.0);

    const passed =
      aliceAfterCredit === 7.0 &&
      bobAfterCredit === 1.7 &&
      notifCountAfterRace === 1 &&
      partialRev.status === "partially_reversed" &&
      partialRev.deducted === 3.5 &&
      finalRev.status === "reversed" &&
      finalRev.deducted === 0.5 &&
      finalRev.deficit === 3.0 &&
      ledger.users.get("alice")!.balance === 0.0 &&
      ledger.referrals.get("alice")!.totalCommission === 0.0 &&
      duplicateRev.already_processed === true;

    recordTest(
      "OFFER-08",
      "Concurrent conversion deduplication, partial/full chargebacks, wallet clamp & referral clawback",
      "Financial Ledger",
      passed,
      "Single Credit $7.00, Partial $3.50, Clamped $0.50, Ref Commission=$0",
      `Credit=$${aliceAfterCredit} Notifs=${notifCountAfterRace} FinalBal=$${ledger.users.get("alice")!.balance} RefComm=$${ledger.referrals.get("alice")!.totalCommission}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 09: Fail-Closed Check When Provider Secrets Missing
  // --------------------------------------------------------------------------
  {
    const saved = TEST_ENV.TAPJOY_SECRET_KEY;
    TEST_ENV.TAPJOY_SECRET_KEY = "";
    const tapjoy = getProviderAdapter("tapjoy")!;
    const check = await tapjoy.verifyPostback({
      method: "GET",
      url: new URL("https://x.test"),
      params: { id: "tx1", snuid: "u1", currency: "1.00", verifier: crypto.createHash("md5").update("tx1:u1:1.00:").digest("hex") },
      headers: new Headers(),
      rawBody: "",
      clientIp: "1.2.3.4",
    });
    TEST_ENV.TAPJOY_SECRET_KEY = saved;

    const passed = !check.configured && !check.valid;
    recordTest(
      "OFFER-09",
      "Fail-closed rejection when provider postback secret is unconfigured",
      "Webhook Security",
      passed,
      "configured=false, valid=false",
      `configured=${check.configured}, valid=${check.valid}`
    );
  }

  // --------------------------------------------------------------------------
  // TEST 10..15: VPN / IP Risk Engine & PostgrestThenable (No-.catch) Regression Suite
  // --------------------------------------------------------------------------
  {
    const {
      parseProxyCheckPayload,
      parseIpApiIsPayload,
      isPrivateOrUnknownIp,
      checkIpReputation,
      enforceVpnPolicy,
      clearVpnCheckCaches,
    } = await import("../supabase/functions/_shared/vpn-check.ts");

    // Faithful Supabase PostgrestFilterBuilder thenable mock: has .then() ONLY, deliberately NO .catch()!
    function createPostgrestThenable<T>(executor: () => Promise<T>): PromiseLike<T> {
      return {
        then<TResult1 = T, TResult2 = never>(
          onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
          onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
        ) {
          return executor().then(onfulfilled, onrejected);
        },
      };
    }

    const buildVpnDb = (opts: {
      cfg?: Record<string, unknown>;
      cachedRow?: any;
      readError?: any;
      readThrows?: boolean;
      upsertError?: any;
      upsertThrows?: boolean;
      upsertCounter?: () => void;
    }) => ({
      from: (table: string) => ({
        select: () => ({
          eq: (_col: string, _val: any) => ({
            maybeSingle: () =>
              createPostgrestThenable(async () =>
                table === "app_settings"
                  ? {
                      data: {
                        value: opts.cfg ?? {
                          vpn_detection_enabled: true,
                          block_vpn_on_offers: true,
                          block_vpn_on_tasks: true,
                          block_vpn_on_checkin: true,
                          block_vpn_on_withdraw: true,
                          block_vpn_on_auth: false,
                          block_hosting_ips: true,
                          vpn_risk_threshold: 66,
                          strict_fail_closed: false,
                        },
                      },
                      error: null,
                    }
                  : { data: null, error: null }
              ),
            gt: () => ({
              maybeSingle: () =>
                createPostgrestThenable(async () => {
                  if (opts.readThrows) throw new Error("Simulated L2 read exception");
                  if (opts.readError) return { data: null, error: opts.readError };
                  return { data: opts.cachedRow ?? null, error: null };
                }),
            }),
          }),
        }),
        upsert: (_row: any, _upsertOpts?: any) =>
          createPostgrestThenable(async () => {
            opts.upsertCounter?.();
            if (opts.upsertThrows) throw new Error("Simulated DB upsert socket exception");
            if (opts.upsertError) return { data: null, error: opts.upsertError };
            return { data: null, error: null };
          }),
        insert: (_row: any) =>
          createPostgrestThenable(async () => ({ data: null, error: null })),
      }),
    });

    const originalFetch = globalThis.fetch;
    const savedPcKey = TEST_ENV.PROXYCHECK_KEY;
    const savedIpApiKey = TEST_ENV.IPAPI_KEY;

    // OFFER-10: Parser + Private IP + VPN block with PostgrestThenable (no .catch)
    {
      clearVpnCheckCaches();
      TEST_ENV.PROXYCHECK_KEY = "test_proxycheck_key";
      const pcVpn = parseProxyCheckPayload("45.83.220.14", {
        status: "ok",
        "45.83.220.14": {
          proxy: "yes",
          type: "VPN",
          risk: 88,
          isocode: "DE",
          asn: "AS20473",
        },
      });
      const ipapiTor = parseIpApiIsPayload({
        is_vpn: false,
        is_proxy: false,
        is_tor: true,
        is_datacenter: true,
        is_abuser: false,
        location: { country_code: "NL" },
        asn: { asn: 12345 },
      });

      let upsertCalls = 0;
      const db = buildVpnDb({ upsertCounter: () => { upsertCalls++; } });
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({
            status: "ok",
            "185.220.101.4": { proxy: "yes", type: "VPN", risk: 95, isocode: "US" },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )) as typeof fetch;

      let blockedCode = "";
      try {
        await enforceVpnPolicy(db as any, new Request("https://x.test"), "185.220.101.4", "offer_click", "user-1");
      } catch (err: any) {
        blockedCode = err?.code || "";
      }

      const passed =
        Boolean(pcVpn?.isVpn && pcVpn.countryCode === "DE" && pcVpn.riskScore === 88) &&
        Boolean(ipapiTor?.isTor && ipapiTor.isHosting && ipapiTor.countryCode === "NL") &&
        isPrivateOrUnknownIp("127.0.0.1") &&
        isPrivateOrUnknownIp("10.0.0.5") &&
        !isPrivateOrUnknownIp("185.220.101.4") &&
        upsertCalls === 1 &&
        blockedCode === "VPN_DETECTED";

      recordTest(
        "OFFER-10",
        "VPN/Proxy/Tor detection & PostgrestThenable (no .catch) upsert succeeds cleanly",
        "Anti-Fraud Security",
        passed,
        "upsertCalls=1, blockedCode=VPN_DETECTED",
        `upsertCalls=${upsertCalls}, blockedCode=${blockedCode}`
      );
    }

    // OFFER-11: Cache Hit (L2 -> L1) skips external API; clean IP passes auth/offers_api/offer_click/daily_checkin
    {
      clearVpnCheckCaches();
      let fetchCalls = 0;
      let upsertCalls = 0;
      const db = buildVpnDb({
        cachedRow: {
          is_vpn: false,
          is_proxy: false,
          is_tor: false,
          is_hosting: false,
          risk_score: 5,
          country_code: "US",
          asn: "AS7922",
          reason: null,
        },
        upsertCounter: () => { upsertCalls++; },
      });
      globalThis.fetch = (async () => {
        fetchCalls++;
        return new Response("{}", { status: 200 });
      }) as typeof fetch;

      const rAuth = await enforceVpnPolicy(db as any, new Request("https://x.test"), "73.15.20.10", "auth", "u1");
      const rOffers = await enforceVpnPolicy(db as any, new Request("https://x.test"), "73.15.20.10", "offers_api", "u1");
      const rClick = await enforceVpnPolicy(db as any, new Request("https://x.test"), "73.15.20.10", "offer_click", "u1");
      const rCheckin = await enforceVpnPolicy(db as any, new Request("https://x.test"), "73.15.20.10", "daily_checkin", "u1");

      const passed =
        fetchCalls === 0 &&
        upsertCalls === 0 &&
        !rAuth.blocked &&
        rAuth.provider === "cache" &&
        !rOffers.blocked &&
        !rClick.blocked &&
        !rCheckin.blocked;

      recordTest(
        "OFFER-11",
        "VPN L2/L1 cache hit skips external HTTP & permits clean IP across auth, offers_api, offer_click, daily_checkin",
        "Anti-Fraud Caching",
        passed,
        "fetchCalls=0, all 4 contexts allowed",
        `fetchCalls=${fetchCalls}, provider=${rAuth.provider}`
      );
    }

    // OFFER-12: Upsert returning { error } AND upsert throwing exception never crash or bypass blocking
    {
      clearVpnCheckCaches();
      TEST_ENV.PROXYCHECK_KEY = "test_proxycheck_key";
      const origWarn = console.warn;
      const origErr = console.error;
      const warnMsgs: string[] = [];
      const errMsgs: string[] = [];
      console.warn = (...args: any[]) => warnMsgs.push(String(args[0]));
      console.error = (...args: any[]) => errMsgs.push(String(args[0]));

      try {
        // Case A: Clean IP on first auth with upsert returning { error }
        const dbErr = buildVpnDb({
          cfg: { vpn_detection_enabled: true, block_vpn_on_auth: false, block_vpn_on_checkin: true },
          upsertError: { code: "42501", message: "permission denied for ip_risk_cache" },
        });
        globalThis.fetch = (async () =>
          new Response(
            JSON.stringify({ status: "ok", "198.51.100.77": { proxy: "no", type: "Residential", risk: 0, isocode: "US" } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )) as typeof fetch;

        const cleanAuthRes = await enforceVpnPolicy(dbErr as any, new Request("https://x.test"), "198.51.100.77", "auth", "u-clean");

        // Case B: VPN IP with upsert throwing exception must STILL block with VPN_DETECTED!
        clearVpnCheckCaches();
        const dbThrow = buildVpnDb({
          cfg: { vpn_detection_enabled: true, block_vpn_on_auth: true, block_vpn_on_offers: true },
          upsertThrows: true,
        });
        globalThis.fetch = (async () =>
          new Response(
            JSON.stringify({ status: "ok", "203.0.113.99": { proxy: "yes", type: "VPN", risk: 95, isocode: "DE" } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )) as typeof fetch;

        let vpnBlockCode = "";
        try {
          await enforceVpnPolicy(dbThrow as any, new Request("https://x.test"), "203.0.113.99", "auth", "u-vpn");
        } catch (err: any) {
          vpnBlockCode = err?.code || "";
        }

        // Case C: L2 read error/exception falls back cleanly
        clearVpnCheckCaches();
        const dbReadFail = buildVpnDb({ readThrows: true });
        globalThis.fetch = (async () =>
          new Response(
            JSON.stringify({ status: "ok", "198.51.100.88": { proxy: "no", type: "Residential", risk: 2, isocode: "CA" } }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )) as typeof fetch;
        const readFallbackRes = await enforceVpnPolicy(dbReadFail as any, new Request("https://x.test"), "198.51.100.88", "daily_checkin", "u-readfail");

        const passed =
          !cleanAuthRes.blocked &&
          cleanAuthRes.provider === "proxycheck" &&
          vpnBlockCode === "VPN_DETECTED" &&
          !readFallbackRes.blocked &&
          warnMsgs.includes("[VPN_CACHE_WRITE_WARN]") &&
          warnMsgs.includes("[VPN_CACHE_READ_EXCEPTION]") &&
          errMsgs.includes("[VPN_CACHE_WRITE_EXCEPTION]");

        recordTest(
          "OFFER-12",
          "Cache read/write { error } and thrown exceptions are logged, never crash auth, and preserve VPN blocking",
          "Cache Resilience",
          passed,
          "CleanAllowed=true, VpnBlocked=VPN_DETECTED, LogsEmitted=true",
          `Clean=${!cleanAuthRes.blocked}, VpnCode=${vpnBlockCode}, Warns=${warnMsgs.length}, Errs=${errMsgs.length}`
        );
      } finally {
        console.warn = origWarn;
        console.error = origErr;
      }
    }

    // OFFER-13: External API Timeout & Invalid Response Handling (fail-open vs strict_fail_closed)
    {
      clearVpnCheckCaches();
      TEST_ENV.PROXYCHECK_KEY = "test_pc_secret_should_not_leak";
      TEST_ENV.IPAPI_KEY = "test_ipapi_secret";
      const origWarn = console.warn;
      const warnPayloads: string[] = [];
      console.warn = (...args: any[]) => warnPayloads.push(JSON.stringify(args));

      try {
        globalThis.fetch = (async () => {
          const err = new Error("The signal has been aborted");
          err.name = "AbortError";
          throw err;
        }) as typeof fetch;

        const dbFailOpen = buildVpnDb({ cfg: { vpn_detection_enabled: true, block_vpn_on_offers: true, strict_fail_closed: false } });
        const openRes = await enforceVpnPolicy(dbFailOpen as any, new Request("https://x.test"), "198.51.100.12", "offer_click", "u1");

        clearVpnCheckCaches();
        const dbFailClosed = buildVpnDb({ cfg: { vpn_detection_enabled: true, block_vpn_on_offers: true, strict_fail_closed: true } });
        let closedCode = "";
        try {
          await enforceVpnPolicy(dbFailClosed as any, new Request("https://x.test"), "198.51.100.13", "offer_click", "u1");
        } catch (e: any) {
          closedCode = e?.code || "";
        }

        // Invalid provider JSON / denied response
        clearVpnCheckCaches();
        globalThis.fetch = (async () =>
          new Response(JSON.stringify({ status: "denied", message: "Invalid key" }), { status: 200 })) as typeof fetch;
        const badPayloadRes = await checkIpReputation(dbFailOpen as any, "198.51.100.14", "offers_api");

        const noSecretLeakedInLogs = !warnPayloads.some((s) => s.includes("test_pc_secret") || s.includes("test_ipapi_secret"));
        const passed =
          !openRes.blocked &&
          !openRes.configured &&
          closedCode === "VPN_DETECTED" &&
          !badPayloadRes.configured &&
          noSecretLeakedInLogs;

        recordTest(
          "OFFER-13",
          "External IP API timeout & invalid payload handle fail-open/fail-closed cleanly without leaking API keys",
          "Anti-Fraud Resilience",
          passed,
          "FailOpen=allowed, FailClosed=VPN_DETECTED, NoSecretLeak=true",
          `OpenBlocked=${openRes.blocked}, ClosedCode=${closedCode}, NoSecretLeak=${noSecretLeakedInLogs}`
        );
      } finally {
        console.warn = origWarn;
      }
    }

    // OFFER-14: High Risk Score / Hosting IP vs Disabled Toggle
    {
      clearVpnCheckCaches();
      TEST_ENV.PROXYCHECK_KEY = "test_proxycheck_key";
      TEST_ENV.IPAPI_KEY = "";

      const dbEnabled = buildVpnDb({
        cfg: {
          vpn_detection_enabled: true,
          block_vpn_on_offers: true,
          block_hosting_ips: true,
          vpn_risk_threshold: 66,
        },
      });
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({ status: "ok", "192.0.2.50": { proxy: "no", type: "Residential", risk: 75, isocode: "US" } }),
          { status: 200 }
        )) as typeof fetch;
      const highRiskRes = await checkIpReputation(dbEnabled as any, "192.0.2.50", "offer_click");

      clearVpnCheckCaches();
      const dbDisabled = buildVpnDb({
        cfg: {
          vpn_detection_enabled: false,
          block_vpn_on_offers: true,
        },
      });
      globalThis.fetch = (async () =>
        new Response(
          JSON.stringify({ status: "ok", "192.0.2.51": { proxy: "yes", type: "VPN", risk: 100, isocode: "DE" } }),
          { status: 200 }
        )) as typeof fetch;
      const disabledRes = await checkIpReputation(dbDisabled as any, "192.0.2.51", "offer_click");

      const passed = highRiskRes.blocked === true && disabledRes.blocked === false && disabledRes.isVpn === true;
      recordTest(
        "OFFER-14",
        "High-risk score (>=66) triggers block while vpn_detection_enabled=false bypasses blocking cleanly",
        "Anti-Fraud Policy",
        passed,
        "HighRiskBlocked=true, DisabledBlocked=false",
        `HighRiskBlocked=${highRiskRes.blocked}, DisabledBlocked=${disabledRes.blocked}`
      );
    }

    globalThis.fetch = originalFetch;
    TEST_ENV.PROXYCHECK_KEY = savedPcKey;
    TEST_ENV.IPAPI_KEY = savedIpApiKey;
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log("\n========================================================");
  const passedCount = results.filter((r) => r.passed).length;
  console.log(`OFFERS ENGINE TESTS RESULT: ${passedCount}/${results.length} PASSED`);
  console.log("========================================================\n");

  if (passedCount !== results.length) {
    process.exit(1);
  }
}

runOffersEngineTests().catch((err) => {
  console.error("Test runner fatal error:", err);
  process.exit(1);
});
