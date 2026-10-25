/**
 * Fingerprints de auth/onboarding/my-stores.
 *
 * `user_uid` y `surface` son auto-fill. Onboarding es funnel crítico para
 * cold-start del recomendador — onboarding_categories_selected llega en el
 * Plan 2 (cold-start). Por ahora solo las 3 huellas que ya existen.
 */

export const A_userLoggedIn = {
  event: 'user_logged_in',
  props: {
    user_uid: 'user.uid',                     // viene del payload, no del session aún
    provider: {
      fn: ({ detail }) => {
        const pd = detail?.user?.providerData;
        if (Array.isArray(pd) && pd.length > 0 && pd[0]?.providerId) {
          return pd[0].providerId;
        }
        return 'unknown';
      },
    },
    source: { literal: 'login' },
  },
};

export const A_onboardingStarted = {
  event: 'onboarding_started',
  props: {
    source: { literal: 'onboarding' },
  },
};

export const A_onboardingStepCompleted = {
  event: 'onboarding_step_completed',
  props: {
    step: 'step',
    source: { literal: 'onboarding' },
  },
};

/**
 * El usuario terminó el paso de "elegí tus categorías favoritas" en onboarding.
 * Input crítico para el cold-start del recomendador — el modelo de v0 (heurística)
 * filtra items por estas categorías cuando no hay historial.
 *
 * Detail esperado del evento DOM:
 *   { categoryIds: [3, 7, 12], categoryNames: ['cafeterias', 'libros', 'belleza'], count: 3 }
 */
export const A_onboardingCategoriesSelected = {
  event: 'onboarding_categories_selected',
  props: {
    category_ids: 'categoryIds',
    category_names: 'categoryNames',
    count: 'count',
    source: { literal: 'onboarding' },
  },
  when: (detail) => Array.isArray(detail?.categoryIds) && detail.categoryIds.length > 0,
};

export const A_onboardingFinished = {
  event: 'onboarding_finished',
  props: {
    source: { literal: 'onboarding' },
  },
};

export const A_myStoresListed = {
  event: 'my_stores_listed',
  props: {
    stores_count: 'storesCount',
    source: { literal: 'my_stores' },
  },
};

export const A_myStoreOpened = {
  event: 'my_store_opened',
  props: {
    store_id: 'storeId',
    store_name: 'storeName',
    source: { literal: 'my_stores' },
  },
  groups: { store: 'storeId' },
};

export const A_myStoreCreateClicked = {
  event: 'my_store_create_clicked',
  props: {
    source: { literal: 'my_stores' },
  },
};
