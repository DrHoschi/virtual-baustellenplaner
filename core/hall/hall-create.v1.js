import { HALL_INDUSTRY_GABLE_V1, normalizeHallConfig } from "./hall-config.v1.js";
import { migrateHallV1ToV2 } from "./hall-migrate-v1-v2.js";

/** Existing project hall creation entry. app.project.hall remains authority. */
export function commitHallCreate({ store, bus, input = {}, reason = "project-ui-04a:create-hall" } = {}) {
  if (!store?.get || !store?.update || !bus?.emit) return { committed:false,hall:null,derived:{},warnings:[],errors:["Hall Creation benötigt Store und Event-Bus."] };
  const app=store.get("app")||{};
  if(!app?.project) return { committed:false,hall:null,derived:{},warnings:[],errors:["Kein geöffnetes Projekt vorhanden."] };
  if(app.project.hall) return { committed:false,hall:app.project.hall,derived:{},warnings:[],errors:["Für dieses Projekt ist bereits eine Halle konfiguriert."] };
  const seed=normalizeHallConfig(HALL_INDUSTRY_GABLE_V1,input);
  if(seed.errors.length) return {committed:false,...seed};
  const result=migrateHallV1ToV2(seed.hall);
  if(result.errors.length) return {committed:false,...result};
  store.update("app",draft=>{if(!draft.project||draft.project.hall)return;draft.project.hall=result.hall;});
  if(!store.get("app")?.project?.hall) return {committed:false,...result,errors:["Halle konnte dem geöffneten Projekt nicht zugeordnet werden."]};
  bus.emit("ui:project:save",{reason});bus.emit("req:hall3d:rebuild",{reason});return {committed:true,...result};
}
