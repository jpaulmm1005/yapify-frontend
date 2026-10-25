import { LitElement, css, html } from 'lit';
import { ScopedElementsMixin } from '@open-wc/scoped-elements/lit-element.js';

import { YapifyPageHeader } from 'yapify-components/src/yapify-page-header.js';

import documents from './legal-documents.json';

/**
 * ![Lit component](https://img.shields.io/badge/Lit-component-blue.svg)
 *
 * Renders one of the shell's legal documents (`terms`, `privacy`) from
 * `legal-documents.json`.
 *
 * These two documents are shell-owned rather than a feature MFE on purpose:
 * they have to be reachable from the login screen, before any session exists,
 * and they must keep working inside the Capacitor build without sending the
 * user out to a browser mid sign-up.
 *
 * Example:
 *
 * ```html
 *   <yapify-legal-page doc="privacy"></yapify-legal-page>
 * ```
 *
 * @customElement yapify-legal-page
 * @LitElement
 *
 * @fires {} page-back - Re-dispatched by the inner `<yapify-page-header>`.
 */
export class YapifyLegalPage extends ScopedElementsMixin(LitElement) {
  static get is() {
    return 'yapify-legal-page';
  }

  static get scopedElements() {
    return {
      'yapify-page-header': YapifyPageHeader,
    };
  }

  static get properties() {
    return {
      /**
       * Which document to render — a top-level key of `legal-documents.json`.
       * @type {String}
       * @default ''
       */
      doc: { type: String },
      /**
       * BCP-47 locale tag to render the document in. Falls back to the only
       * locale the document ships when the requested one is missing.
       * @type {String}
       * @default ''
       */
      locale: { type: String },
    };
  }

  constructor() {
    super();
    this.doc = '';
    this.locale = '';
  }

  /**
   * The localised document body, falling back to the `fallback` placeholder
   * when `doc` names no known document. A legal text is binding, so an
   * unreviewed machine translation would be worse than none: an unknown
   * locale falls back to the one the document was written and reviewed in
   * instead of rendering missing-key placeholders.
   *
   * @returns {Object} `{ title, lead, updated, sections }`.
   * @readonly
   * @private
   */
  get _document() {
    const fallbackLocale = 'es-PE';
    const localised = documents[this.doc] ?? documents.fallback;
    return localised[this.locale] ?? localised[fallbackLocale];
  }

  /**
   * Renders one numbered section of the document.
   *
   * @param {Object} section - `{ heading, paragraphs, bullets }`.
   * @param {Number} index - Zero-based position, rendered as a 2-digit number.
   * @returns {import('lit').TemplateResult}
   * @private
   */
  _renderSection(section, index) {
    return html`
      <section class="legal__section">
        <h2 class="legal__heading">
          <span class="legal__num">${String(index + 1).padStart(2, '0')}</span>
          ${section.heading}
        </h2>
        ${(section.paragraphs ?? []).map(
          (text) => html`<p class="legal__paragraph">${text}</p>`,
        )}
        ${section.bullets
          ? html`
              <ul class="legal__list">
                ${section.bullets.map((text) => html`<li>${text}</li>`)}
              </ul>
            `
          : ''}
      </section>
    `;
  }

  static get styles() {
    return [
      css`
        :host {
          display: block;
          min-height: 100vh;
          background: var(--yp-bg-page);
          color: var(--yp-text-primary);
        }

        .legal__body {
          padding: 1.25rem 1rem 4rem;
        }

        .legal__title {
          margin: 0;
          font-size: 1.75rem;
          font-weight: 700;
          line-height: 1.2;
          color: var(--yp-text-primary);
        }

        .legal__lead {
          margin: 0.75rem 0 0;
          font-size: 1rem;
          line-height: 1.6;
          color: var(--yp-text-dim);
        }

        .legal__updated {
          display: block;
          margin-top: 1rem;
          font-size: 0.8125rem;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          color: var(--yp-text-muted);
        }

        .legal__section {
          margin-top: 2.25rem;
          padding-top: 1.75rem;
          border-top: 1px solid var(--yp-border);
        }

        .legal__heading {
          display: flex;
          gap: 0.625rem;
          align-items: baseline;
          margin: 0 0 0.75rem;
          font-size: 1.125rem;
          font-weight: 600;
          line-height: 1.35;
          color: var(--yp-text-primary);
        }

        .legal__num {
          flex: none;
          font-size: 0.8125rem;
          font-weight: 700;
          color: var(--yp-accent-ink);
        }

        .legal__paragraph,
        .legal__list {
          margin: 0 0 0.75rem;
          font-size: 0.9375rem;
          line-height: 1.7;
          color: var(--yp-text-dim);
        }

        .legal__list {
          padding-left: 1.125rem;
        }

        .legal__list li {
          margin-bottom: 0.5rem;
        }

        @media (min-width: 768px) {
          .legal__body {
            padding: 1.5rem 2rem 5rem;
          }

          .legal__title {
            font-size: 2.25rem;
          }
        }

        @media (min-width: 1280px) {
          .legal__body {
            padding: 2rem 3rem 6rem;
          }
        }

        @media (min-width: 1600px) {
          .legal__body {
            padding: 2rem 4rem 6rem;
          }
        }
      `,
    ];
  }

  render() {
    const doc = this._document;
    return html`
      <yapify-page-header label=${doc.title}></yapify-page-header>
      <article class="legal__body">
        <h1 class="legal__title">${doc.title}</h1>
        <p class="legal__lead">${doc.lead}</p>
        <span class="legal__updated">${doc.updated}</span>
        ${doc.sections.map((section, index) => this._renderSection(section, index))}
      </article>
    `;
  }
}
