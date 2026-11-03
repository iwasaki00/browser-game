const images:Record<string,string>=typeof window==='undefined'?{}:import.meta.glob<string>('./assets/treasures/*/*.png',{eager:true,query:'?url',import:'default'});
const byId=new Map(Object.entries(images).map(([path,url])=>[path.split('/').at(-1)!.replace('.png',''),url]));
export const treasureImage=(id:string)=>byId.get(id);
