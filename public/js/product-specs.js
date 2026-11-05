(() => {
  const editor = document.querySelector('[data-product-spec-editor]');
  if (!editor) return;

  const categoryInputs = Array.from(document.querySelectorAll('input[name="category"]'));
  const groups = Array.from(editor.querySelectorAll('[data-spec-group]'));

  function refresh() {
    const selected = categoryInputs.find(input => input.checked)?.value || '';
    const groupName = !selected
      ? null
      : (selected === 'Aquatic Life' || selected === 'Plants' ? selected : 'Equipment Maintenance');

    groups.forEach(group => {
      const active = Boolean(groupName) && group.dataset.specGroup === groupName;
      group.classList.toggle('d-none', !active);
      group.querySelectorAll('input, select, textarea').forEach(control => {
        control.disabled = !active;
      });
    });
  }

  categoryInputs.forEach(input => input.addEventListener('change', refresh));
  refresh();
})();
