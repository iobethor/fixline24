(function () {
  'use strict';

  // Stable public contract for the future on-site AI assistant. Administrative
  // writes remain on the authenticated server-side /admin/api surface.
  var root = document.documentElement;

  function text(selector) {
    var node = document.querySelector(selector);
    return node ? node.textContent.trim().replace(/\s+/g, ' ') : '';
  }

  function getContext() {
    var entity = document.querySelector('[data-ai-entity]');
    var section = document.querySelector('[data-ai-section]');
    var phone = document.querySelector('a[href^="tel:"]');
    var email = document.querySelector('a[href^="mailto:"]');
    return {
      contract: document.body.dataset.aiContract || 'fixica-v1',
      url: location.pathname,
      title: document.title,
      heading: text('h1'),
      section: section ? section.dataset.aiSection : '',
      entity: entity ? { type: entity.dataset.aiEntity, slug: entity.dataset.aiSlug || '' } : null,
      contacts: {
        phone: phone ? phone.getAttribute('href') : '',
        email: email ? email.getAttribute('href') : ''
      }
    };
  }

  function openLeadForm(topic) {
    var opener = document.querySelector('[data-modal-open="lead"]');
    if (!opener) return false;
    if (topic) opener.setAttribute('data-product', String(topic).slice(0, 240));
    opener.click();
    return true;
  }

  window.FixicaAssistant = Object.freeze({
    version: '1.0.0',
    getContext: getContext,
    openLeadForm: openLeadForm,
    on: function (name, handler) { root.addEventListener('fixica:' + name, handler); },
    emit: function (name, detail) { root.dispatchEvent(new CustomEvent('fixica:' + name, { detail: detail })); }
  });

  root.dispatchEvent(new CustomEvent('fixica:assistant-ready', { detail: getContext() }));
})();
