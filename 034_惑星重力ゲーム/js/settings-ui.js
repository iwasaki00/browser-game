// Dialogs live outside the layout grid. Opening/closing never resets game inputs.
export function createSettingsUI({onOpen=()=>{}}={}) {
  const $=selector=>document.querySelector(selector);
  const dialogs=[$('#displayPanel'),$('#planetPanel')];
  const sync=()=>document.body?.classList?.toggle('settings-open',dialogs.some(dialog=>dialog.open));
  for(const [index,name] of ['Display','Planet'].entries()) {
    const dialog=dialogs[index];
    $('#open'+name+'Settings').addEventListener('click',()=>{
      if(dialog.open)return;
      onOpen();dialog.showModal();sync();
    });
    $('#close'+name+'Settings').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',sync);
  }
  return {isOpen:()=>dialogs.some(dialog=>Boolean(dialog.open))};
}
