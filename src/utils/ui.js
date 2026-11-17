import Toastify from 'toastify-js';
import Swal from 'sweetalert2';

export const toast = (message, type = 'success') =>
  Toastify({
    text: message,
    duration: 3200,
    gravity: 'top',
    position: 'right',
    className: 'toastify'
  }).showToast();

export const notifyError = (message) => toast(message, 'error');

export const confirmAction = async (opts) => {
  const result = await Swal.fire({
    title: opts.title || '¿Está seguro?',
    text: opts.text || 'Esta acción no se puede deshacer.',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: opts.confirmText || 'Confirmar',
    cancelButtonText: 'Cancelar',
    confirmButtonColor: '#c7f13a'
  });
  return result.isConfirmed;
};

export const alertInfo = (opts) =>
  Swal.fire({
    title: opts.title || '',
    html: opts.html || opts.text || '',
    icon: opts.icon || 'info',
    confirmButtonText: opts.okText || 'Entendido'
  });

export function openModal({ title, bodyHtml, footerHtml, onMount, size = '' }) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true">
      <div class="modal__head">
        <h3 class="modal__title">${title}</h3>
        <button type="button" class="icon-btn modal-close" aria-label="Cerrar">✕</button>
      </div>
      <div class="modal__body">${bodyHtml}</div>
      ${footerHtml ? `<div class="modal__foot">${footerHtml}</div>` : ''}
    </div>
  `;

  const close = () => {
    backdrop.remove();
    document.body.style.overflow = '';
  };
  backdrop.querySelector('.modal-close').addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';

  if (onMount) onMount(backdrop, close);
  return { close, el: backdrop };
}