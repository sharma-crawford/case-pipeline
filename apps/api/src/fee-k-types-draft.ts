// =============================================================================
// Fee K Types — the starting draft (P11.3.6)
// =============================================================================
// What Settings → Firm → Fee K Types shows until an admin first saves the
// table. Only a SAVED table is used (the auto-fill reads data/fee-k-types.json),
// so nothing here reaches Monday before someone reviews it.
//
// Boards: where Fee Ks were actually sent, from "It will go to…" on ~1,700 Fee
// Ks under their old "Contract for…" labels (2026-10-20); the clear majority,
// with "Already in board" read as the board the case already lives on. Waivers
// stay in Prescheduling, in the Fee Ks board's Waivers group ("Waivers"); address
// changes go to Address Changes (a label to add on Monday — until it exists the
// auto-fill skips it). Left empty where no board fits (PD requests, briefs, the
// 10th Circuit argument, criminal consequences).
// Prescheduling (2026-10-29): yes when the type has a suggested Buzón document
// list (documents to collect), no for the types that need nothing from the
// client (address changes, FOIA to EOIR, G-28, appeals, briefs, litigation…).
// Spanish: reviewed by Rafael 2026-10-20. Fee sheet jobs: matched to "FINAL
// COPY OF FIRM FEES 2026.xlsx" (Sheet1, 2026-10-20); empty where no job fits.
// Picked among several (check in Settings): DACA → renewal-our client, TPS →
// initial, Deferred Action → initial, N-600 → simple, 42A / 42B → non
// emergency, Detained Master → Master Hearing, NOID → simple, Interview Prep +
// Rep → Interview (KC only).
// =============================================================================

import type { FeeKTypeRow } from "./fee-k-types.js";
import { SUGGESTED_DOCUMENTS } from "./fee-k-type-documents-draft.js";

const OF = "Open Forms";
const OFC = "Open Forms-Court Forms";
const WAIVERS = "Waivers";
const ADDRESS = "Address Changes";

const rows: [feeKType: string, spanish: string, board: string, feeSheetJob: string][] = [
  ["I-485 + I-130 - Full Packet", "Paquete completo: ajuste de estatus (I-485) y petición familiar (I-130)", OF, "Full Packet"],
  ["I-130 - Petition for Alien Relative", "Petición de familiar extranjero (I-130)", OF, "I-130 (Online)"],
  ["I-485 - Adjustment of Status", "Ajuste de estatus (I-485)", OF, "I-485 (adjustment only- family based)"],
  ["I-485 - In Proceedings AOS (c)", "Ajuste de estatus ante la Corte de Inmigración (I-485)", OFC, "I-485 (Adjustment of Status in Court)"],
  ["I-485 - T Visa AOS", "Ajuste de estatus por visa T (I-485)", OF, ""],
  ["I-485 - UVisa AOS", "Ajuste de estatus por visa U (I-485)", OF, "I-485 (U-Visa Adjustment)"],
  ["I-485 - VAWA AOS", "Ajuste de estatus por VAWA (I-485)", OF, ""],
  ["I-485 - SIJS AOS", "Ajuste de estatus por SIJS (I-485)", OF, "I-485 only (refugee or SIJS )"],
  ["I-485 - CAA AOS", "Ajuste de estatus por la Ley de Ajuste Cubano (I-485)", OF, "I-485 (Cuban Adjustment Act)"],
  ["I-765 - EAD Renewal", "Renovación del permiso de trabajo (I-765)", OF, "I-765 (online)- See EAD tab"],
  ["I-765 - Initial EAD", "Permiso de trabajo inicial (I-765)", OF, "I-765 (online)- See EAD tab"],
  ["I-131 - Advance Parole", "Permiso de viaje / Advance Parole (I-131)", OF, "I-131 Advance parole"],
  ["I-131 - Military PIP Advance Parole", "Permiso de viaje por Parole in Place militar (I-131)", OF, "I-131 PIP (Military based)"],
  ["I-821D - DACA - Childhood Deferred Action", "DACA: acción diferida para los llegados en la infancia (I-821D)", OF, "DACA (renewal-our client)"],
  ["I-821 - TPS Deferred Action", "Estatus de protección temporal, TPS (I-821)", OF, "TPS (initial/late initial)"],
  ["I-821 - Deferred Action", "Acción diferida (I-821)", OF, "Deferred Action Initial (non DACA)"],
  ["I-129F - K1 Petition for Alien Fiancé(e)", "Petición de visa K-1 para prometido(a) (I-129F)", OF, "I-129F (K-1)"],
  ["I-360 - VAWA", "Autopetición VAWA (I-360)", OF, "VAWA (I-360)"],
  ["I-360 - SIJS", "Petición de estatus especial de inmigrante juvenil, SIJS (I-360)", OF, "SIJS (I-360)"],
  ["I-751 - LPR Removal of Conditions", "Eliminación de condiciones de la residencia (I-751)", OF, "I-751 (Removal of Conditions)"],
  ["N-400 - Naturalization", "Ciudadanía / naturalización (N-400)", OF, "N-400"],
  ["N-600 - Certificate of Citizenship", "Certificado de ciudadanía (N-600)", OF, "N-600 (simple)"],
  ["N-336 - Request for a Hearing Denied N400", "Solicitud de audiencia por N-400 negada (N-336)", OF, ""],
  ["I-90 - GC Renewal", "Renovación de la tarjeta de residencia (I-90)", OF, "I-90"],
  ["I-90 - GC Replacement", "Reemplazo de la tarjeta de residencia (I-90)", OF, "I-90"],
  ["I-929 - Petition for Qualifying Family Member of a U-1 Nonimmigrant", "Petición para familiar calificado de titular de visa U (I-929)", OF, "I-929"],
  ["I-918A - Supp of UVisa Derivative", "Petición para familiar derivado de visa U (I-918A)", OF, ""],
  ["I-918B - UVisa Certification Request", "Solicitud de certificación para visa U (I-918B)", "I-918Bs", "I-918B"],
  ["I-914 - TVisa", "Visa T (I-914)", OF, "I-914/I-192 (T-Visa) each derivative $2500.00"],
  ["I-914 + I-192 - TVisa + Waiver", "Visa T y perdón (I-914 e I-192)", OF, "I-914/I-192 (T-Visa) each derivative $2500.00"],
  ["I-539 - Extend/Change Nonimmigrant Status", "Extensión o cambio de estatus de no inmigrante (I-539)", OF, "I-539 (Change or extension of Status )"],
  ["I-824 - Action on an Approved Application or Petition", "Acción sobre una solicitud o petición aprobada (I-824)", OF, "I-824"],
  ["I-102 - Replacement of I94 Entry Doc", "Reemplazo del registro de entrada I-94 (I-102)", OF, ""],
  ["I-290B - USCIS Appeal", "Apelación o moción ante USCIS (I-290B)", OF, "I-290B"],
  ["I-589 - Affirmative Asylum", "Asilo afirmativo (I-589)", OF, "I-589 (Asylum)"],
  ["I-589 - Defensive Asylum  (c)", "Asilo defensivo ante la Corte de Inmigración (I-589)", OFC, "I-589 (Asylum)"],
  ["E42A - LPR Cancellation of Removal (c)", "Cancelación de deportación para residentes permanentes (EOIR-42A)", OFC, "EOIR 42A(non emergency)"],
  ["E42B -  Cancellation of Removal (c)", "Cancelación de deportación para no residentes (EOIR-42B)", OFC, "EOIR 42B(non emergency)"],
  ["CVP - Consular Visa Process", "Proceso consular de visa", OF, "Consular Processing (visa Packet)"],
  ["DS-160", "Solicitud de visa de no inmigrante (DS-160)", OF, "DS-160 (NVC Non-immigrant Application)"],
  ["G28 - USCIS Entry of Appearance", "Representación ante USCIS (G-28)", OF, ""],
  ["Adams packet", "Paquete Adams", OF, ""],
  ["File Copy", "Copia del expediente", OF, "File Copy"],
  ["Investigation", "Investigación de antecedentes migratorios", OF, "Investigation Fee"],
  ["USCIS RFE Response", "Respuesta a solicitud de evidencia (RFE) de USCIS", "RFEs", "Normal RFE"],
  ["USCIS NOID Response", "Respuesta a aviso de intención de negar (NOID) de USCIS", "RFEs", "NOID (simple)"],
  ["Interview Prep + Rep", "Preparación y representación en la entrevista", "Interviews", "Interview (KC only)"],
  ["Interview Prep Only", "Preparación para la entrevista (sin representación)", "Interviews", "Interview Prep (only)"],
  ["FOIA", "Solicitud de expediente (FOIA)", "FOIA requests", "FOIA (G639)"],
  ["FOIA - EOIR", "Solicitud de expediente (FOIA) a la Corte de Inmigración (EOIR)", "FOIA requests", "FOIA (EOIR)"],
  ["FOIA - OBIM", "Solicitud de expediente (FOIA) a OBIM", "FOIA requests", ""],
  ["FOIA - FBI", "Solicitud de antecedentes al FBI (FOIA)", "FOIA requests", ""],
  ["FOIA - OBIM + FBI", "Solicitud de expediente (FOIA) a OBIM y al FBI", "FOIA requests", "FOIA (OBIM + FBI)"],
  ["Master (c)", "Audiencia preliminar (master)", "Court Cases", "Master Hearing"],
  ["Detained Master (c)", "Audiencia preliminar (master) con detención", "Court Cases", "Master Hearing"],
  ["Trial (c)", "Juicio", "Court Cases", "Trial"],
  ["Trial Prep  (c)", "Preparación del juicio", "Court Cases", "Trial Prep"],
  ["Trial/Trial Preparation  (c)", "Juicio y preparación del juicio", "Court Cases", ""],
  ["DETAINED TP + T (c)", "Preparación del juicio y juicio con detención", "Court Cases", ""],
  ["Motion (c)", "Moción ante la Corte de Inmigración", "Motions", ""],
  ["Bond MTN  (c)", "Moción de fianza", "Motions", "Motion for Bond-non emergency"],
  ["Emergency Bond MTN (c)", "Moción de fianza de emergencia", "Motions", "Motion for Bond-emergency"],
  ["E26 - BIA Appeal (c)", "Apelación ante la Junta de Apelaciones de Inmigración (EOIR-26)", "Appeals", "BIA Appeal"],
  ["BRIEF - BIA Appeal (2nd half)  (c)", "Escrito de apelación ante la Junta de Apelaciones (segunda parte)", "Appeals", ""],
  ["Habeas", "Hábeas corpus", "Litigations", ""],
  ["Mandamus", "Demanda de mandamus", "Litigations", "Mandamus/APA"],
  ["Litigation", "Litigio", "Litigations", ""],
  ["Federal Litigation", "Litigio federal", "Litigations", ""],
  ["AAF - Annual Asylum Fee", "Cuota anual de asilo", "Already in board", ""],
  // Waivers stay in Prescheduling, in the Waivers group.
  ["I-601A - Waiver", "Perdón provisional por presencia ilegal (I-601A)", WAIVERS, "I-601A (Waiver for unlawful presence)"],
  ["I-601 - Waiver", "Perdón de inadmisibilidad (I-601)", WAIVERS, "I-601 (only)"],
  ["I-212 - Waiver", "Permiso para volver a solicitar admisión (I-212)", WAIVERS, "I-212, Application for Permission to Reapply for Admission into the United States After Deportation or Removal"],
  ["I-601 + I-212 - Waiver", "Perdones de inadmisibilidad (I-601 e I-212)", WAIVERS, ""],
  ["E33 - Address Change (c)", "Cambio de dirección ante la Corte de Inmigración (EOIR-33)", ADDRESS, "Address Changes for Immigration court"],
  ["AR-11 - USCIS Address Change", "Cambio de dirección ante USCIS (AR-11)", ADDRESS, "USCIS Address changes"],
  ["Address Change - E33 + AR11", "Cambio de dirección ante la Corte y USCIS (EOIR-33 y AR-11)", ADDRESS, ""],
  // No board yet: none of the "It will go to…" boards fits.
  ["PD Request (c)", "Solicitud de discreción procesal ante la Corte de Inmigración", "", "PD Requests (Immigration Court)"],
  ["Brief  (c)", "Escrito legal (brief) ante la Corte de Inmigración", "", ""],
  ["Oral Argument 10th Circuit Court", "Argumento oral ante la Corte de Apelaciones del Décimo Circuito", "", "Oral Argument"],
  ["Criminal Consequences", "Consecuencias migratorias de un caso penal", "", "Criminal Consequence letter"],
];

// Scope of services, approved by Michael + Rekha 2026-10-23 ("Scope of Services -
// DRAFT for attorney review", section 3). [included EN, included ES, not included EN, not included ES]
const SCOPE: Record<string, [string, string, string, string]> = {
  "I-130 - Petition for Alien Relative": [
    "Prepare and file Form I-130 with the evidence of your relationship.",
    "Preparar y presentar el Formulario I-130 con la evidencia de su relación familiar.",
    "Adjustment of status (I-485) or consular processing; the Affidavit of Support (I-864); any interview.",
    "El ajuste de estatus (I-485) o el proceso consular; la Declaración Jurada de Patrocinio (I-864); cualquier entrevista.",
  ],
  "I-485 + I-130 - Full Packet": [
    "Prepare and file Forms I-130 and I-485 with the Affidavit of Support (I-864) and supporting evidence.",
    "Preparar y presentar los Formularios I-130 e I-485 con la Declaración Jurada de Patrocinio (I-864) y la evidencia correspondiente.",
    "Attending the interview (separate Interview contract); medical exam (I-693) fees.",
    "Acompañarlo(a) a la entrevista (contrato de Entrevista por separado); el costo del examen médico (I-693).",
  ],
  "I-765 - EAD Renewal": [
    "Prepare and file Form I-765 to renew your work permit.",
    "Preparar y presentar el Formulario I-765 para renovar su permiso de trabajo.",
    "Any other application.",
    "Cualquier otra solicitud.",
  ],
  "I-821D - DACA - Childhood Deferred Action": [
    "Prepare and file your DACA renewal: Forms I-821D, I-765 and I-765WS.",
    "Preparar y presentar su renovación de DACA: Formularios I-821D, I-765 e I-765WS.",
    "Advance parole (I-131).",
    "El permiso de viaje (I-131).",
  ],
  "I-751 - LPR Removal of Conditions": [
    "Prepare and file Form I-751 with evidence of your marriage (or with the waiver request that applies).",
    "Preparar y presentar el Formulario I-751 con la evidencia de su matrimonio (o con la solicitud de exención que corresponda).",
    "Attending the interview, if USCIS schedules one.",
    "Acompañarlo(a) a la entrevista, si USCIS la programa.",
  ],
  "N-400 - Naturalization": [
    "Prepare and file Form N-400.",
    "Preparar y presentar el Formulario N-400.",
    "Interview preparation or attendance; a request for a hearing (N-336) if it is denied.",
    "La preparación o la asistencia a la entrevista; una solicitud de audiencia (N-336) si es negada.",
  ],
  "I-90 - GC Renewal": [
    "Prepare and file Form I-90 to renew your permanent resident card.",
    "Preparar y presentar el Formulario I-90 para renovar su tarjeta de residente permanente.",
    "Any other application.",
    "Cualquier otra solicitud.",
  ],
  "I-90 - GC Replacement": [
    "Prepare and file Form I-90 to replace your permanent resident card.",
    "Preparar y presentar el Formulario I-90 para reemplazar su tarjeta de residente permanente.",
    "Any other application.",
    "Cualquier otra solicitud.",
  ],
  "I-601A - Waiver": [
    "Prepare and file Form I-601A with the evidence of extreme hardship to your qualifying relative.",
    "Preparar y presentar el Formulario I-601A con la evidencia de dificultad extrema para su familiar calificado.",
    "The consular interview; a waiver of a prior removal (I-212); psychological or other evaluations.",
    "La entrevista consular; el perdón por una deportación previa (I-212); evaluaciones psicológicas u otras.",
  ],
  "USCIS RFE Response": [
    "Prepare and file one response to the Request for Evidence on your application.",
    "Preparar y presentar una respuesta a la Solicitud de Evidencia sobre su solicitud.",
    "Any later request for evidence or notice of intent to deny.",
    "Cualquier solicitud de evidencia o aviso de intención de negar posterior.",
  ],
  "FOIA": [
    "Prepare and file your records request(s) with the agency(ies) named above and follow up until the records arrive.",
    "Preparar y presentar su(s) solicitud(es) de expediente ante la(s) agencia(s) indicada(s) y darle seguimiento hasta recibir los documentos.",
    "Appealing a denied or incomplete response.",
    "Apelar una respuesta negada o incompleta.",
  ],
  // Written by an attorney, Spanish confirmed 2026-10-29. Government fees point
  // at the Fees section: the firm often collects the visa fee as the FF.
  "CVP - Consular Visa Process": [
    "Preparing the following forms, reviewing the evidence for sufficiency and submitting them to the relevant authorities: DS-260 (Immigrant Visa Application) and I-864 (Affidavit of Support). Reviewing your civil documents and submitting them to the National Visa Center so your case becomes documentarily qualified. Relaying the U.S. Embassy's scheduling of your immigrant visa interview, including forwarding the instructions for the medical exam.",
    "Preparar los siguientes formularios, revisar que la evidencia sea suficiente y presentarlos ante las autoridades correspondientes: DS-260 (Solicitud de Visa de Inmigrante) e I-864 (Declaración Jurada de Patrocinio). Revisar sus documentos civiles y presentarlos ante el Centro Nacional de Visas para que su caso quede documentalmente completo. Comunicarle la programación de su entrevista de visa de inmigrante por parte de la Embajada de los Estados Unidos, incluyendo el envío de las instrucciones para el examen médico.",
    "The I-130 Petition for Alien Relative; waivers of inadmissibility (I-601, I-601A, I-212); legal services for 221(g) administrative processing or for the Embassy's requests for additional documents, which require additional attorney's fees and a new contract. Government fees collected under this contract are listed in the Fees section; the immigrant medical exam, biometrics and any other fee not listed there are your own responsibility.",
    "La Petición de Familiar Extranjero I-130; los perdones de inadmisibilidad (I-601, I-601A, I-212); los servicios legales relacionados con el procesamiento administrativo 221(g) o con las solicitudes de documentos adicionales de la Embajada, que requieren honorarios adicionales y un nuevo contrato. Las tarifas del gobierno que se cobran en este contrato aparecen en la sección de Honorarios; el examen médico de inmigrante, la toma de datos biométricos y cualquier otra tarifa que no aparezca allí son su responsabilidad.",
  ],

  // Every other type: drafted 2026-11-03 in the style of the approved ones, FOR
  // ATTORNEY REVIEW. Court templates print their own fixed scope, so the "(c)"
  // rows only show where a template uses {{services}}. Adams packet is left
  // empty: nothing here says what it covers.
  "I-485 - Adjustment of Status": [
    "Prepare and file Form I-485 with the Affidavit of Support (I-864) and supporting evidence, based on your family petition.",
    "Preparar y presentar el Formulario I-485 con la Declaración Jurada de Patrocinio (I-864) y la evidencia correspondiente, con base en su petición familiar.",
    "The family petition (I-130); the work permit (I-765) or advance parole (I-131) unless listed above; attending the interview (separate Interview contract); medical exam (I-693) fees.",
    "La petición familiar (I-130); el permiso de trabajo (I-765) o de viaje (I-131), salvo que aparezcan arriba; acompañarlo(a) a la entrevista (contrato de Entrevista por separado); el costo del examen médico (I-693).",
  ],
  "I-485 - In Proceedings AOS (c)": [
    "Prepare and file Form I-485 with the Immigration Court, with the supporting evidence, and serve a copy on DHS.",
    "Preparar y presentar el Formulario I-485 ante la Corte de Inmigración con la evidencia correspondiente, y entregar una copia al DHS.",
    "Representation at your hearings (separate hearing contract); the petition your adjustment is based on; biometrics and medical exam (I-693) fees.",
    "La representación en sus audiencias (contrato de audiencia por separado); la petición en la que se basa su ajuste; el costo de los datos biométricos y del examen médico (I-693).",
  ],
  "I-485 - T Visa AOS": [
    "Prepare and file Form I-485 to become a permanent resident based on your T visa, with the supporting evidence.",
    "Preparar y presentar el Formulario I-485 para obtener la residencia permanente con base en su visa T, con la evidencia correspondiente.",
    "Applications for your family members (each needs its own contract); any waiver of inadmissibility; attending the interview; medical exam (I-693) fees.",
    "Las solicitudes de sus familiares (cada una requiere su propio contrato); cualquier perdón de inadmisibilidad; acompañarlo(a) a la entrevista; el costo del examen médico (I-693).",
  ],
  "I-485 - UVisa AOS": [
    "Prepare and file Form I-485 to become a permanent resident based on your U visa, with the supporting evidence.",
    "Preparar y presentar el Formulario I-485 para obtener la residencia permanente con base en su visa U, con la evidencia correspondiente.",
    "Applications for your family members, including Form I-929 (each needs its own contract); any waiver of inadmissibility; attending the interview; medical exam (I-693) fees.",
    "Las solicitudes de sus familiares, incluido el Formulario I-929 (cada una requiere su propio contrato); cualquier perdón de inadmisibilidad; acompañarlo(a) a la entrevista; el costo del examen médico (I-693).",
  ],
  "I-485 - VAWA AOS": [
    "Prepare and file Form I-485 to become a permanent resident based on your VAWA self-petition, with the supporting evidence.",
    "Preparar y presentar el Formulario I-485 para obtener la residencia permanente con base en su autopetición VAWA, con la evidencia correspondiente.",
    "The VAWA self-petition (I-360); applications for your family members; any waiver of inadmissibility; attending the interview; medical exam (I-693) fees.",
    "La autopetición VAWA (I-360); las solicitudes de sus familiares; cualquier perdón de inadmisibilidad; acompañarlo(a) a la entrevista; el costo del examen médico (I-693).",
  ],
  "I-485 - SIJS AOS": [
    "Prepare and file Form I-485 to become a permanent resident based on your Special Immigrant Juvenile Status, with the supporting evidence.",
    "Preparar y presentar el Formulario I-485 para obtener la residencia permanente con base en su estatus especial de inmigrante juvenil, con la evidencia correspondiente.",
    "The state court case and the SIJS petition (I-360); any waiver of inadmissibility; attending the interview; medical exam (I-693) fees.",
    "El caso ante la corte estatal y la petición SIJS (I-360); cualquier perdón de inadmisibilidad; acompañarlo(a) a la entrevista; el costo del examen médico (I-693).",
  ],
  "I-485 - CAA AOS": [
    "Prepare and file Form I-485 to become a permanent resident under the Cuban Adjustment Act, with the supporting evidence.",
    "Preparar y presentar el Formulario I-485 para obtener la residencia permanente bajo la Ley de Ajuste Cubano, con la evidencia correspondiente.",
    "Applications for your family members (each needs its own contract); any waiver of inadmissibility; attending the interview; medical exam (I-693) fees.",
    "Las solicitudes de sus familiares (cada una requiere su propio contrato); cualquier perdón de inadmisibilidad; acompañarlo(a) a la entrevista; el costo del examen médico (I-693).",
  ],
  "I-765 - Initial EAD": [
    "Prepare and file Form I-765 for your first work permit, in the category that applies to you.",
    "Preparar y presentar el Formulario I-765 para su primer permiso de trabajo, en la categoría que le corresponda.",
    "The main application your work permit depends on; any renewal.",
    "La solicitud principal de la que depende su permiso de trabajo; cualquier renovación.",
  ],
  "I-131 - Advance Parole": [
    "Prepare and file Form I-131 to request permission to travel abroad and return to the United States.",
    "Preparar y presentar el Formulario I-131 para solicitar permiso para viajar al extranjero y regresar a los Estados Unidos.",
    "Representation at the airport or border when you return; any other application.",
    "La representación en el aeropuerto o la frontera a su regreso; cualquier otra solicitud.",
  ],
  "I-131 - Military PIP Advance Parole": [
    "Prepare and file Form I-131 to request parole in place as the family member of a U.S. service member or veteran, with the supporting evidence.",
    "Preparar y presentar el Formulario I-131 para solicitar el Parole in Place como familiar de un miembro o veterano de las Fuerzas Armadas de los Estados Unidos, con la evidencia correspondiente.",
    "Adjustment of status (I-485); the work permit (I-765); any other application.",
    "El ajuste de estatus (I-485); el permiso de trabajo (I-765); cualquier otra solicitud.",
  ],
  "I-821 - TPS Deferred Action": [
    "Prepare and file Form I-821 for Temporary Protected Status, and Form I-765 if you request a work permit.",
    "Preparar y presentar el Formulario I-821 para el Estatus de Protección Temporal, y el Formulario I-765 si solicita permiso de trabajo.",
    "Re-registration in later periods; advance parole (I-131); any other application.",
    "La reinscripción en periodos posteriores; el permiso de viaje (I-131); cualquier otra solicitud.",
  ],
  "I-821 - Deferred Action": [
    "Prepare and file your request for deferred action with the supporting evidence, and Form I-765 if you qualify for a work permit.",
    "Preparar y presentar su solicitud de acción diferida con la evidencia correspondiente, y el Formulario I-765 si califica para un permiso de trabajo.",
    "Any renewal; advance parole (I-131); representation in Immigration Court.",
    "Cualquier renovación; el permiso de viaje (I-131); la representación ante la Corte de Inmigración.",
  ],
  "I-129F - K1 Petition for Alien Fiancé(e)": [
    "Prepare and file Form I-129F for your fiancé(e) with the evidence of your relationship.",
    "Preparar y presentar el Formulario I-129F para su prometido(a) con la evidencia de su relación.",
    "The consular visa process and the interview abroad; adjustment of status (I-485) after the marriage.",
    "El proceso consular y la entrevista en el extranjero; el ajuste de estatus (I-485) después del matrimonio.",
  ],
  "I-360 - VAWA": [
    "Prepare and file your VAWA self-petition (Form I-360) with your declaration and supporting evidence.",
    "Preparar y presentar su autopetición VAWA (Formulario I-360) con su declaración y la evidencia correspondiente.",
    "Adjustment of status (I-485); the work permit (I-765); psychological or other evaluations.",
    "El ajuste de estatus (I-485); el permiso de trabajo (I-765); evaluaciones psicológicas u otras.",
  ],
  "I-360 - SIJS": [
    "Prepare and file Form I-360 for Special Immigrant Juvenile Status with the state court order and supporting evidence.",
    "Preparar y presentar el Formulario I-360 para el estatus especial de inmigrante juvenil, con la orden de la corte estatal y la evidencia correspondiente.",
    "The state court case that issues the order; adjustment of status (I-485); the work permit (I-765).",
    "El caso ante la corte estatal que emite la orden; el ajuste de estatus (I-485); el permiso de trabajo (I-765).",
  ],
  "N-600 - Certificate of Citizenship": [
    "Prepare and file Form N-600 with the evidence that you acquired or derived U.S. citizenship through your parent(s).",
    "Preparar y presentar el Formulario N-600 con la evidencia de que adquirió o derivó la ciudadanía estadounidense a través de su(s) padre(s).",
    "Attending the interview, if USCIS schedules one; a U.S. passport application; an appeal if it is denied.",
    "Acompañarlo(a) a la entrevista, si USCIS la programa; la solicitud de pasaporte estadounidense; una apelación si es negada.",
  ],
  "N-336 - Request for a Hearing Denied N400": [
    "Prepare and file Form N-336 to request a hearing on your denied naturalization application, with the legal argument and supporting evidence.",
    "Preparar y presentar el Formulario N-336 para solicitar una audiencia sobre su solicitud de naturalización negada, con el argumento legal y la evidencia correspondiente.",
    "Attending the hearing with USCIS, unless listed above; a new N-400; review in federal court.",
    "Acompañarlo(a) a la audiencia con USCIS, salvo que aparezca arriba; una nueva solicitud N-400; la revisión ante una corte federal.",
  ],
  "I-929 - Petition for Qualifying Family Member of a U-1 Nonimmigrant": [
    "Prepare and file Form I-929 for your qualifying family member, with the evidence of your relationship.",
    "Preparar y presentar el Formulario I-929 para su familiar calificado, con la evidencia de su relación.",
    "Your own adjustment of status (I-485); your family member's consular processing or adjustment of status.",
    "Su propio ajuste de estatus (I-485); el proceso consular o el ajuste de estatus de su familiar.",
  ],
  "I-918A - Supp of UVisa Derivative": [
    "Prepare and file Form I-918 Supplement A for your qualifying family member, with the supporting evidence.",
    "Preparar y presentar el Formulario I-918 Suplemento A para su familiar calificado, con la evidencia correspondiente.",
    "Your own U visa petition (I-918); a waiver (I-192) or work permit for your family member; consular processing.",
    "Su propia petición de visa U (I-918); el perdón (I-192) o el permiso de trabajo de su familiar; el proceso consular.",
  ],
  "I-918B - UVisa Certification Request": [
    "Prepare and send the request for U visa certification (Form I-918 Supplement B) to the certifying agency, and follow up with it.",
    "Preparar y enviar la solicitud de certificación para visa U (Formulario I-918 Suplemento B) a la agencia certificadora y darle seguimiento.",
    "The U visa petition (I-918); a guarantee that the agency will sign the certification.",
    "La petición de visa U (I-918); una garantía de que la agencia firme la certificación.",
  ],
  "I-914 - TVisa": [
    "Prepare and file your T visa application (Form I-914) with your declaration and supporting evidence.",
    "Preparar y presentar su solicitud de visa T (Formulario I-914) con su declaración y la evidencia correspondiente.",
    "Applications for your family members (I-914 Supplement A); any waiver (I-192); adjustment of status (I-485).",
    "Las solicitudes de sus familiares (I-914 Suplemento A); cualquier perdón (I-192); el ajuste de estatus (I-485).",
  ],
  "I-914 + I-192 - TVisa + Waiver": [
    "Prepare and file your T visa application (Form I-914) with the waiver of inadmissibility (Form I-192), your declaration and supporting evidence.",
    "Preparar y presentar su solicitud de visa T (Formulario I-914) con el perdón de inadmisibilidad (Formulario I-192), su declaración y la evidencia correspondiente.",
    "Applications for your family members (I-914 Supplement A); adjustment of status (I-485).",
    "Las solicitudes de sus familiares (I-914 Suplemento A); el ajuste de estatus (I-485).",
  ],
  "I-539 - Extend/Change Nonimmigrant Status": [
    "Prepare and file Form I-539 to extend or change your nonimmigrant status, with the supporting evidence.",
    "Preparar y presentar el Formulario I-539 para extender o cambiar su estatus de no inmigrante, con la evidencia correspondiente.",
    "A new visa from a U.S. consulate; any other application.",
    "Una nueva visa en un consulado de los Estados Unidos; cualquier otra solicitud.",
  ],
  "I-824 - Action on an Approved Application or Petition": [
    "Prepare and file Form I-824 to request a duplicate approval notice or to have your approved application or petition sent to the National Visa Center or a U.S. consulate.",
    "Preparar y presentar el Formulario I-824 para solicitar un duplicado del aviso de aprobación o para que su solicitud o petición aprobada se envíe al Centro Nacional de Visas o a un consulado de los Estados Unidos.",
    "The consular visa process; any other application.",
    "El proceso consular de visa; cualquier otra solicitud.",
  ],
  "I-102 - Replacement of I94 Entry Doc": [
    "Prepare and file Form I-102 to replace or correct your arrival-departure record (I-94).",
    "Preparar y presentar el Formulario I-102 para reemplazar o corregir su registro de entrada y salida (I-94).",
    "Any other application.",
    "Cualquier otra solicitud.",
  ],
  "I-290B - USCIS Appeal": [
    "Prepare and file Form I-290B to appeal one USCIS decision or ask USCIS to reopen or reconsider it, with the legal argument and supporting evidence.",
    "Preparar y presentar el Formulario I-290B para apelar una decisión de USCIS o pedirle que la reabra o la reconsidere, con el argumento legal y la evidencia correspondiente.",
    "A new application; review in federal court; any later appeal or motion.",
    "Una nueva solicitud; la revisión ante una corte federal; cualquier apelación o moción posterior.",
  ],
  "I-589 - Affirmative Asylum": [
    "Prepare and file your asylum application (Form I-589) with USCIS, with your declaration and supporting evidence.",
    "Preparar y presentar su solicitud de asilo (Formulario I-589) ante USCIS, con su declaración y la evidencia correspondiente.",
    "Attending the asylum interview (separate Interview contract); the work permit (I-765); the annual asylum fee; Immigration Court proceedings if your case is referred to the court.",
    "Acompañarlo(a) a la entrevista de asilo (contrato de Entrevista por separado); el permiso de trabajo (I-765); la cuota anual de asilo; el proceso ante la Corte de Inmigración si su caso es remitido a la corte.",
  ],
  "I-589 - Defensive Asylum  (c)": [
    "Prepare and file your asylum application (Form I-589) with the Immigration Court, with your declaration and supporting evidence, and serve a copy on DHS.",
    "Preparar y presentar su solicitud de asilo (Formulario I-589) ante la Corte de Inmigración, con su declaración y la evidencia correspondiente, y entregar una copia al DHS.",
    "Representation at your hearings (separate hearing contract); the work permit (I-765); the annual asylum fee; an appeal.",
    "La representación en sus audiencias (contrato de audiencia por separado); el permiso de trabajo (I-765); la cuota anual de asilo; una apelación.",
  ],
  "E42A - LPR Cancellation of Removal (c)": [
    "Prepare and file your application for cancellation of removal for permanent residents (Form EOIR-42A) with the Immigration Court, with the supporting evidence, and serve a copy on DHS.",
    "Preparar y presentar su solicitud de cancelación de deportación para residentes permanentes (Formulario EOIR-42A) ante la Corte de Inmigración, con la evidencia correspondiente, y entregar una copia al DHS.",
    "Representation at your hearings (separate hearing contract); biometrics fees; psychological or other evaluations; an appeal.",
    "La representación en sus audiencias (contrato de audiencia por separado); el costo de los datos biométricos; evaluaciones psicológicas u otras; una apelación.",
  ],
  "E42B -  Cancellation of Removal (c)": [
    "Prepare and file your application for cancellation of removal for nonpermanent residents (Form EOIR-42B) with the Immigration Court, with the evidence of hardship to your qualifying relatives, and serve a copy on DHS.",
    "Preparar y presentar su solicitud de cancelación de deportación para no residentes (Formulario EOIR-42B) ante la Corte de Inmigración, con la evidencia de la dificultad para sus familiares calificados, y entregar una copia al DHS.",
    "Representation at your hearings (separate hearing contract); the work permit (I-765); biometrics fees; psychological or other evaluations; an appeal.",
    "La representación en sus audiencias (contrato de audiencia por separado); el permiso de trabajo (I-765); el costo de los datos biométricos; evaluaciones psicológicas u otras; una apelación.",
  ],
  "DS-160": [
    "Prepare and submit your nonimmigrant visa application (Form DS-160) online.",
    "Preparar y enviar en línea su solicitud de visa de no inmigrante (Formulario DS-160).",
    "Attending the consular interview; the visa application fee; any waiver.",
    "Acompañarlo(a) a la entrevista consular; la tarifa de la solicitud de visa; cualquier perdón.",
  ],
  "G28 - USCIS Entry of Appearance": [
    "Prepare and file Form G-28 so that USCIS recognizes this firm as your representative on the case named above, and receive copies of USCIS notices.",
    "Preparar y presentar el Formulario G-28 para que USCIS reconozca a esta firma como su representante en el caso indicado, y recibir copias de los avisos de USCIS.",
    "Preparing or filing any application, response or appeal; attending any interview.",
    "Preparar o presentar cualquier solicitud, respuesta o apelación; acompañarlo(a) a cualquier entrevista.",
  ],
  "File Copy": [
    "Prepare and deliver to you an electronic copy of your file kept by this firm.",
    "Preparar y entregarle una copia electrónica de su expediente que conserva esta firma.",
    "Requesting records from the government (FOIA); reviewing the file or giving legal advice about it.",
    "Solicitar expedientes al gobierno (FOIA); revisar el expediente o darle asesoría legal sobre él.",
  ],
  "Investigation": [
    "Review your immigration and criminal history with the documents you provide, and give you our assessment of the options available to you.",
    "Revisar su historial migratorio y penal con los documentos que nos proporcione, y darle nuestra evaluación de las opciones disponibles para usted.",
    "Records requests (FOIA) unless listed above; preparing or filing any application.",
    "Las solicitudes de expediente (FOIA), salvo que aparezcan arriba; preparar o presentar cualquier solicitud.",
  ],
  "USCIS NOID Response": [
    "Prepare and file one response to the Notice of Intent to Deny on your application.",
    "Preparar y presentar una respuesta al Aviso de Intención de Negar sobre su solicitud.",
    "Any later request for evidence or notice of intent to deny; an appeal or motion if the application is denied.",
    "Cualquier solicitud de evidencia o aviso de intención de negar posterior; una apelación o moción si la solicitud es negada.",
  ],
  "Interview Prep + Rep": [
    "Prepare you for your interview and attend it with you.",
    "Prepararlo(a) para su entrevista y acompañarlo(a) a ella.",
    "Any request for evidence or notice of intent to deny after the interview; a second interview; travel outside the Kansas City area.",
    "Cualquier solicitud de evidencia o aviso de intención de negar posterior a la entrevista; una segunda entrevista; viajes fuera del área de Kansas City.",
  ],
  "Interview Prep Only": [
    "Prepare you for your interview: review your application and practice the questions you may be asked.",
    "Prepararlo(a) para su entrevista: revisar su solicitud y practicar las preguntas que le podrían hacer.",
    "Attending the interview with you; any later request for evidence or notice of intent to deny.",
    "Acompañarlo(a) a la entrevista; cualquier solicitud de evidencia o aviso de intención de negar posterior.",
  ],
  "FOIA - EOIR": [
    "Prepare and file your records request with the Immigration Court (EOIR) and follow up until the records arrive.",
    "Preparar y presentar su solicitud de expediente ante la Corte de Inmigración (EOIR) y darle seguimiento hasta recibir los documentos.",
    "Requests to other agencies; appealing a denied or incomplete response.",
    "Solicitudes a otras agencias; apelar una respuesta negada o incompleta.",
  ],
  "FOIA - OBIM": [
    "Prepare and file your records request with OBIM (the Department of Homeland Security's biometric records office) and follow up until the records arrive.",
    "Preparar y presentar su solicitud de expediente ante OBIM (la oficina de registros biométricos del Departamento de Seguridad Nacional) y darle seguimiento hasta recibir los documentos.",
    "Requests to other agencies; appealing a denied or incomplete response.",
    "Solicitudes a otras agencias; apelar una respuesta negada o incompleta.",
  ],
  "FOIA - FBI": [
    "Prepare and file your request for your FBI criminal history record (Identity History Summary) and follow up until it arrives.",
    "Preparar y presentar su solicitud de antecedentes penales del FBI (Identity History Summary) y darle seguimiento hasta recibirla.",
    "Fingerprinting fees; requests to other agencies; appealing a denied or incomplete response.",
    "El costo de la toma de huellas; solicitudes a otras agencias; apelar una respuesta negada o incompleta.",
  ],
  "FOIA - OBIM + FBI": [
    "Prepare and file your records requests with OBIM and the FBI and follow up until the records arrive.",
    "Preparar y presentar sus solicitudes de expediente ante OBIM y el FBI y darles seguimiento hasta recibir los documentos.",
    "Fingerprinting fees; requests to other agencies; appealing a denied or incomplete response.",
    "El costo de la toma de huellas; solicitudes a otras agencias; apelar una respuesta negada o incompleta.",
  ],
  "Master (c)": [
    "Represent you at your master calendar hearing at the Immigration Court and file the pleadings the court requires.",
    "Representarlo(a) en su audiencia preliminar (master) ante la Corte de Inmigración y presentar los alegatos que la corte requiera.",
    "Applications for relief; motions; the individual hearing (trial); any appeal.",
    "Las solicitudes de alivio migratorio; las mociones; la audiencia individual (juicio); cualquier apelación.",
  ],
  "Detained Master (c)": [
    "Represent you at your master calendar hearing at the Immigration Court while you are detained, and file the pleadings the court requires.",
    "Representarlo(a) en su audiencia preliminar (master) ante la Corte de Inmigración mientras está detenido(a), y presentar los alegatos que la corte requiera.",
    "Bond (separate Bond contract); applications for relief; motions; the individual hearing (trial); any appeal.",
    "La fianza (contrato de Fianza por separado); las solicitudes de alivio migratorio; las mociones; la audiencia individual (juicio); cualquier apelación.",
  ],
  "Trial (c)": [
    "Represent you at your individual hearing (trial) at the Immigration Court.",
    "Representarlo(a) en su audiencia individual (juicio) ante la Corte de Inmigración.",
    "Trial preparation (separate Trial Prep contract) unless listed above; any appeal.",
    "La preparación del juicio (contrato de Preparación del Juicio por separado), salvo que aparezca arriba; cualquier apelación.",
  ],
  "Trial Prep  (c)": [
    "Prepare your case for your individual hearing: file the evidence and witness list, prepare your declaration, and prepare you and your witnesses to testify.",
    "Preparar su caso para su audiencia individual: presentar la evidencia y la lista de testigos, preparar su declaración, y prepararlo(a) a usted y a sus testigos para declarar.",
    "Representation at the hearing itself (separate Trial contract); expert reports and evaluations; any appeal.",
    "La representación en la audiencia (contrato de Juicio por separado); informes de expertos y evaluaciones; cualquier apelación.",
  ],
  "Trial/Trial Preparation  (c)": [
    "Prepare your case for your individual hearing (the evidence, witness list, your declaration, and preparing you and your witnesses to testify) and represent you at the hearing.",
    "Preparar su caso para su audiencia individual (la evidencia, la lista de testigos, su declaración y la preparación de usted y sus testigos para declarar) y representarlo(a) en la audiencia.",
    "Expert reports and evaluations; any appeal.",
    "Informes de expertos y evaluaciones; cualquier apelación.",
  ],
  "DETAINED TP + T (c)": [
    "While you are detained, prepare your case for your individual hearing (the evidence, witness list, your declaration, and preparing you and your witnesses to testify) and represent you at the hearing.",
    "Mientras está detenido(a), preparar su caso para su audiencia individual (la evidencia, la lista de testigos, su declaración y la preparación de usted y sus testigos para declarar) y representarlo(a) en la audiencia.",
    "Bond (separate Bond contract); expert reports and evaluations; any appeal.",
    "La fianza (contrato de Fianza por separado); informes de expertos y evaluaciones; cualquier apelación.",
  ],
  "Motion (c)": [
    "Prepare and file the motion named above with the Immigration Court, with the supporting evidence, and serve a copy on DHS.",
    "Preparar y presentar ante la Corte de Inmigración la moción indicada, con la evidencia correspondiente, y entregar una copia al DHS.",
    "Any other motion; any hearing the motion leads to; an appeal if it is denied.",
    "Cualquier otra moción; cualquier audiencia que resulte de la moción; una apelación si es negada.",
  ],
  "Bond MTN  (c)": [
    "Prepare and file a motion for a bond hearing with the Immigration Court, with the supporting evidence, and represent you at the bond hearing.",
    "Preparar y presentar ante la Corte de Inmigración una moción para una audiencia de fianza, con la evidencia correspondiente, y representarlo(a) en la audiencia de fianza.",
    "The bond amount itself; a bond appeal; your removal case (master and individual hearings).",
    "El monto de la fianza; una apelación de la fianza; su caso de deportación (audiencias preliminares e individuales).",
  ],
  "Emergency Bond MTN (c)": [
    "On an expedited basis, prepare and file a motion for a bond hearing with the Immigration Court, with the supporting evidence, and represent you at the bond hearing.",
    "De forma urgente, preparar y presentar ante la Corte de Inmigración una moción para una audiencia de fianza, con la evidencia correspondiente, y representarlo(a) en la audiencia de fianza.",
    "The bond amount itself; a bond appeal; your removal case (master and individual hearings).",
    "El monto de la fianza; una apelación de la fianza; su caso de deportación (audiencias preliminares e individuales).",
  ],
  "E26 - BIA Appeal (c)": [
    "Prepare and file the notice of appeal (Form EOIR-26) with the Board of Immigration Appeals.",
    "Preparar y presentar el aviso de apelación (Formulario EOIR-26) ante la Junta de Apelaciones de Inmigración.",
    "The appeal brief (the second half of the appeal, separate contract); review in federal court.",
    "El escrito de apelación (la segunda parte de la apelación, contrato por separado); la revisión ante una corte federal.",
  ],
  "BRIEF - BIA Appeal (2nd half)  (c)": [
    "Review the record and the hearing transcript, and prepare and file your appeal brief with the Board of Immigration Appeals.",
    "Revisar el expediente y la transcripción de la audiencia, y preparar y presentar su escrito de apelación ante la Junta de Apelaciones de Inmigración.",
    "Review in federal court; any motion after the Board's decision.",
    "La revisión ante una corte federal; cualquier moción después de la decisión de la Junta.",
  ],
  "Habeas": [
    "Prepare and file a petition for a writ of habeas corpus in federal district court challenging your detention, and represent you in that case.",
    "Preparar y presentar ante la corte federal de distrito una petición de hábeas corpus que impugne su detención, y representarlo(a) en ese caso.",
    "Your Immigration Court case; bond hearings; an appeal to the Court of Appeals.",
    "Su caso ante la Corte de Inmigración; las audiencias de fianza; una apelación ante la Corte de Apelaciones.",
  ],
  "Mandamus": [
    "Prepare and file a lawsuit in federal district court asking the court to order the agency to decide your delayed application, and represent you in that case.",
    "Preparar y presentar una demanda ante la corte federal de distrito para pedir que la corte ordene a la agencia decidir su solicitud demorada, y representarlo(a) en ese caso.",
    "The underlying application; any interview or request for evidence that follows; an appeal.",
    "La solicitud principal; cualquier entrevista o solicitud de evidencia que resulte; una apelación.",
  ],
  "Litigation": [
    "Represent you in the lawsuit named above, from filing through the court's decision.",
    "Representarlo(a) en la demanda indicada, desde su presentación hasta la decisión de la corte.",
    "Any appeal; any related administrative or Immigration Court case.",
    "Cualquier apelación; cualquier caso administrativo o ante la Corte de Inmigración relacionado.",
  ],
  "Federal Litigation": [
    "Represent you in the federal court case named above, from filing through the court's decision.",
    "Representarlo(a) en el caso ante la corte federal indicado, desde su presentación hasta la decisión de la corte.",
    "Any appeal; any related administrative or Immigration Court case.",
    "Cualquier apelación; cualquier caso administrativo o ante la Corte de Inmigración relacionado.",
  ],
  "AAF - Annual Asylum Fee": [
    "Submit the annual asylum fee payment to USCIS for your pending asylum application and send you the receipt.",
    "Presentar a USCIS el pago de la cuota anual de asilo de su solicitud pendiente y enviarle el recibo.",
    "Any other application; the fee for later years.",
    "Cualquier otra solicitud; la cuota de los años siguientes.",
  ],
  "I-601 - Waiver": [
    "Prepare and file Form I-601 with the evidence of extreme hardship to your qualifying relative.",
    "Preparar y presentar el Formulario I-601 con la evidencia de dificultad extrema para su familiar calificado.",
    "The consular interview; a waiver of a prior removal (I-212); psychological or other evaluations.",
    "La entrevista consular; el perdón por una deportación previa (I-212); evaluaciones psicológicas u otras.",
  ],
  "I-212 - Waiver": [
    "Prepare and file Form I-212 to request permission to reapply for admission after a deportation or removal, with the supporting evidence.",
    "Preparar y presentar el Formulario I-212 para solicitar permiso para volver a solicitar la admisión después de una deportación, con la evidencia correspondiente.",
    "The consular interview; any other waiver (I-601, I-601A); psychological or other evaluations.",
    "La entrevista consular; cualquier otro perdón (I-601, I-601A); evaluaciones psicológicas u otras.",
  ],
  "I-601 + I-212 - Waiver": [
    "Prepare and file Forms I-601 and I-212 with the evidence of extreme hardship to your qualifying relative and the supporting evidence.",
    "Preparar y presentar los Formularios I-601 e I-212 con la evidencia de dificultad extrema para su familiar calificado y la evidencia correspondiente.",
    "The consular interview; psychological or other evaluations.",
    "La entrevista consular; evaluaciones psicológicas u otras.",
  ],
  "E33 - Address Change (c)": [
    "Prepare and file your change of address (Form EOIR-33) with the Immigration Court and serve a copy on DHS.",
    "Preparar y presentar su cambio de dirección (Formulario EOIR-33) ante la Corte de Inmigración y entregar una copia al DHS.",
    "Changing your address with USCIS (AR-11) or ICE; a motion to change venue.",
    "El cambio de dirección ante USCIS (AR-11) o ICE; una moción de cambio de sede.",
  ],
  "AR-11 - USCIS Address Change": [
    "File your change of address with USCIS (Form AR-11) and update the address on your pending cases.",
    "Presentar su cambio de dirección ante USCIS (Formulario AR-11) y actualizar la dirección en sus casos pendientes.",
    "Changing your address with the Immigration Court (EOIR-33) or ICE.",
    "El cambio de dirección ante la Corte de Inmigración (EOIR-33) o ICE.",
  ],
  "Address Change - E33 + AR11": [
    "File your change of address with the Immigration Court (Form EOIR-33, with a copy to DHS) and with USCIS (Form AR-11).",
    "Presentar su cambio de dirección ante la Corte de Inmigración (Formulario EOIR-33, con copia al DHS) y ante USCIS (Formulario AR-11).",
    "Changing your address with ICE; a motion to change venue.",
    "El cambio de dirección ante ICE; una moción de cambio de sede.",
  ],
  "PD Request (c)": [
    "Prepare and send DHS a request for prosecutorial discretion in your Immigration Court case, with the supporting evidence, and follow up on it.",
    "Preparar y enviar al DHS una solicitud de discreción procesal en su caso ante la Corte de Inmigración, con la evidencia correspondiente, y darle seguimiento.",
    "The motion to dismiss or close the case that may follow; representation at your hearings; a guarantee that DHS will agree.",
    "La moción para terminar o cerrar el caso que pueda resultar; la representación en sus audiencias; una garantía de que el DHS acepte.",
  ],
  "Brief  (c)": [
    "Research, prepare and file the legal brief named above with the Immigration Court.",
    "Investigar, preparar y presentar ante la Corte de Inmigración el escrito legal indicado.",
    "Representation at your hearings; any other brief or motion.",
    "La representación en sus audiencias; cualquier otro escrito o moción.",
  ],
  "Oral Argument 10th Circuit Court": [
    "Prepare and present oral argument in your case before the U.S. Court of Appeals for the Tenth Circuit.",
    "Preparar y presentar el argumento oral en su caso ante la Corte de Apelaciones de los Estados Unidos para el Décimo Circuito.",
    "The petition for review and the briefs, unless listed above; a petition for rehearing or to the U.S. Supreme Court.",
    "La petición de revisión y los escritos, salvo que aparezcan arriba; una solicitud de nueva audiencia o ante la Corte Suprema de los Estados Unidos.",
  ],
  "Criminal Consequences": [
    "Review your criminal case and immigration history, and write a letter explaining the immigration consequences of the charges or the plea offered.",
    "Revisar su caso penal y su historial migratorio, y redactar una carta que explique las consecuencias migratorias de los cargos o del acuerdo de culpabilidad ofrecido.",
    "Representation in the criminal case; any immigration application or court case.",
    "La representación en el caso penal; cualquier solicitud o caso migratorio.",
  ],
};

export const DRAFT_FEE_K_TYPES: FeeKTypeRow[] = rows.map(([feeKType, spanish, board, feeSheetJob]) => {
  const [services = "", servicesEs = "", excluded = "", excludedEs = ""] = SCOPE[feeKType] ?? [];
  const prescheduling = (SUGGESTED_DOCUMENTS[feeKType]?.length ?? 0) > 0;
  return { feeKType, spanish, board, feeSheetJob, prescheduling, services, servicesEs, excluded, excludedEs, documents: [] };
});
