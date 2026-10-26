// Dialogs live outside the layout grid. Opening/closing never resets game inputs.
export function createSettingsUI({onOpen=()=>{}}={}) {
  const $=selector=>document.querySelector(selector);
  const dialogs=[$('#menuPanel'),$('#displayPanel'),$('#planetPanel'),$('#encounterPanel')];
  const sync=()=>document.body?.classList?.toggle('settings-open',dialogs.some(dialog=>dialog.open));
  const closeAll=()=>{for(const dialog of dialogs)if(dialog.open)dialog.close();sync();};
  for(const [index,name] of ['Menu','Display','Planet','Encounter'].entries()) {
    const dialog=dialogs[index];
    $('#open'+name+'Settings').addEventListener('click',()=>{
      if(dialog.open)return;
      onOpen();closeAll();dialog.showModal();sync();
    });
    $('#close'+name+'Settings').addEventListener('click',()=>dialog.close());
    dialog.addEventListener('close',sync);
  }
  for(const selector of ['#openStages','#openGallery'])$(selector).addEventListener('click',closeAll);
  return {isOpen:()=>dialogs.some(dialog=>Boolean(dialog.open)),closeAll};
}
