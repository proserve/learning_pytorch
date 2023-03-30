module.exports = {
    data: [
        {
            "allowConnections": true,
            "auditing": {
              "enabled": true
            },
            "canCascadeDelete": false,
            "connectionOptions": {
              "requireAccept": true,
              "requiredAccess": 5,
              "sendNotifications": true
            },
            "createAcl": [
              "role.administrator"
            ],
            "defaultAcl": [
              "owner.delete",
              "role.administrator.delete"
            ],
            "description": "An object representing a participant group in a study in Axon",
            "favorite": false,
            "hasETag": false,
            "hasOwner": true,
            "isDeletable": true,
            "isUnmanaged": false,
            "isVersioned": false,
            "label": "Participant Group",
            "locales": {
              "description": [
                {
                  "locale": "en_US",
                  "value": "An object representing a participant group in a study in Axon"
                }
              ],
              "label": [
                {
                  "locale": "en_US",
                  "value": "Participant Group"
                },
                {
                  "locale": "af_ZA",
                  "value": "Deelnemer Groep"
                },
                {
                  "locale": "ar_SA",
                  "value": "مجموعة المشاركين"
                },
                {
                  "locale": "bg_BG",
                  "value": "Група участници"
                },
                {
                  "locale": "cs_CZ",
                  "value": "Skupina účastníků"
                },
                {
                  "locale": "da_DK",
                  "value": "Deltagergruppe"
                },
                {
                  "locale": "de_CH",
                  "value": "Teilnehmergruppe"
                },
                {
                  "locale": "de_DE",
                  "value": "Teilnehmergruppe"
                },
                {
                  "locale": "el_GR",
                  "value": "Ομάδα συμμετεχόντων"
                },
                {
                  "locale": "es_ES",
                  "value": "Grupo participante"
                },
                {
                  "locale": "es_MX",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "es_US",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "fr_BE",
                  "value": "Groupe de participants"
                },
                {
                  "locale": "fr_CA",
                  "value": "Groupe de participants"
                },
                {
                  "locale": "fr_CH",
                  "value": "Groupe de participants"
                },
                {
                  "locale": "fr_FR",
                  "value": "Groupe de participants"
                },
                {
                  "locale": "he_IL",
                  "value": "קבוצת המשתתף"
                },
                {
                  "locale": "hu_HU",
                  "value": "Résztvevői csoport"
                },
                {
                  "locale": "it_IT",
                  "value": "Gruppo di partecipanti"
                },
                {
                  "locale": "ja_JP",
                  "value": "参加者グループ"
                },
                {
                  "locale": "ka_GE",
                  "value": "მონაწილის ჯგუფი"
                },
                {
                  "locale": "ko_KR",
                  "value": "참가자 그룹"
                },
                {
                  "locale": "lt_LT",
                  "value": "Dalyvių grupė"
                },
                {
                  "locale": "lv_LV",
                  "value": "Dalībnieku grupa"
                },
                {
                  "locale": "ms_MY",
                  "value": "Kumpulan Peserta"
                },
                {
                  "locale": "nl_BE",
                  "value": "Deelnemersgroep"
                },
                {
                  "locale": "nl_NL",
                  "value": "Deelnemersgroep"
                },
                {
                  "locale": "pl_PL",
                  "value": "Grupa uczestników"
                },
                {
                  "locale": "pt_BR",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "pt_PT",
                  "value": "Grupo participante"
                },
                {
                  "locale": "ro_RO",
                  "value": "Grup participant"
                },
                {
                  "locale": "ru_RU",
                  "value": "Группа участников"
                },
                {
                  "locale": "ru_UA",
                  "value": "Группа участников"
                },
                {
                  "locale": "sk_SK",
                  "value": "Skupina účastníkov"
                },
                {
                  "locale": "sr_Latn_RS",
                  "value": "Grupa učesnika"
                },
                {
                  "locale": "st_ZA",
                  "value": "Sehlopha sa Bonkakarolo"
                },
                {
                  "locale": "sv_SE",
                  "value": "Deltagargrupp"
                },
                {
                  "locale": "tr_TR",
                  "value": "Katılımcı Grubu"
                },
                {
                  "locale": "uk_UA",
                  "value": "Група учасника"
                },
                {
                  "locale": "zh_CN",
                  "value": "参与者群组"
                },
                {
                  "locale": "zh_TW",
                  "value": "參與者小組"
                },
                {
                  "locale": "zu_ZA",
                  "value": "Iqembu Lababambiqhaza"
                },
                {
                  "locale": "gu_IN",
                  "value": "સહભાગી જૂથ"
                },
                {
                  "locale": "hi_IN",
                  "value": "प्रतिभागी समूह"
                },
                {
                  "locale": "kn_IN",
                  "value": "ಭಾಗಿಯ ಗುಂಪು"
                },
                {
                  "locale": "ml_IN",
                  "value": "പങ്കെടുക്കുന്ന ഗ്രൂപ്പ്"
                },
                {
                  "locale": "mr_IN",
                  "value": "सहभागी गट"
                },
                {
                  "locale": "or_IN",
                  "value": "ଅଂଶଗ୍ରହଣକାରୀ ଗୋଷ୍ଠୀ"
                },
                {
                  "locale": "pa_IN",
                  "value": "ਭਾਗੀਦਾਰ ਸਮੂਹ"
                },
                {
                  "locale": "ta_IN",
                  "value": "பங்கேற்பாளர் குழு"
                },
                {
                  "locale": "te_IN",
                  "value": "పాల్గొనేవారి గ్రూపు"
                },
                {
                  "locale": "th_TH",
                  "value": "กลุ่มผู้เข้าร่วมการวิจัย"
                },
                {
                  "locale": "bn_IN",
                  "value": "অংশগ্রহণকারী দল"
                },
                {
                  "locale": "ceb_PH",
                  "value": "Grupo sa Sumasalmot"
                },
                {
                  "locale": "de_AT",
                  "value": "Teilnehmergruppe"
                },
                {
                  "locale": "en_AU",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_CA",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_GB",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_NZ",
                  "value": "Participant Group"
                },
                {
                  "locale": "hr_HR",
                  "value": "Skupina ispitanika"
                },
                {
                  "locale": "sl_SI",
                  "value": "Skupina udeležencev"
                },
                {
                  "locale": "sr_Cyrl_RS",
                  "value": "Група учесника"
                },
                {
                  "locale": "sr_Latn",
                  "value": "Grupa učesnika"
                },
                {
                  "locale": "tl_PH",
                  "value": "Kalahok na Grupo"
                },
                {
                  "locale": "ar_DZ",
                  "value": "مجموعة المشاركين"
                },
                {
                  "locale": "ar_IL",
                  "value": "مجموعة المشاركين"
                },
                {
                  "locale": "ar_LB",
                  "value": "مجموعة المشاركين"
                },
                {
                  "locale": "as_IN",
                  "value": "অংশগ্ৰহণকাৰী গোট"
                },
                {
                  "locale": "ca_ES",
                  "value": "Grup participant"
                },
                {
                  "locale": "de_BE",
                  "value": "Teilnehmergruppe"
                },
                {
                  "locale": "en_BE",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_HK",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_IE",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_IL",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_IN",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_JM",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_MY",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_PH",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_SG",
                  "value": "Participant Group"
                },
                {
                  "locale": "en_ZA",
                  "value": "Participant group"
                },
                {
                  "locale": "es_419",
                  "value": "Grupo Participante"
                },
                {
                  "locale": "es_AR",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "es_CL",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "es_CO",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "es_GT",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "es_PE",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "et_EE",
                  "value": "Osalejate rühm"
                },
                {
                  "locale": "fi_FI",
                  "value": "Osallistujaryhmä"
                },
                {
                  "locale": "fil_PH",
                  "value": "Grupo ng Kalahok"
                },
                {
                  "locale": "fr_DZ",
                  "value": "Groupe de participants"
                },
                {
                  "locale": "gl_ES",
                  "value": "Grupo participante"
                },
                {
                  "locale": "it_CH",
                  "value": "Gruppo partecipanti"
                },
                {
                  "locale": "ms_Arab_MY",
                  "value": "Kumpulan Peserta"
                },
                {
                  "locale": "ms_Latn_MY",
                  "value": "Kumpulan Peserta"
                },
                {
                  "locale": "ms_Latn_SG",
                  "value": "Kumpulan Peserta"
                },
                {
                  "locale": "nn_NO",
                  "value": "Deltakergruppe"
                },
                {
                  "locale": "nso_ZA",
                  "value": "Sehlopa sa Motšeakarolo"
                },
                {
                  "locale": "pa_Guru_IN",
                  "value": "ਭਾਗੀਦਾਰ ਸਮੂਹ"
                },
                {
                  "locale": "ro_MD",
                  "value": "Grup participant"
                },
                {
                  "locale": "ru_EE",
                  "value": "Группа участников"
                },
                {
                  "locale": "ru_IL",
                  "value": "Группа участников"
                },
                {
                  "locale": "ru_LT",
                  "value": "Группа участников"
                },
                {
                  "locale": "ru_LV",
                  "value": "Группа участников"
                },
                {
                  "locale": "si_LK",
                  "value": "සහභාගිවන්නාගේ කණ්ඩායම"
                },
                {
                  "locale": "sv_FI",
                  "value": "Deltagargrupp"
                },
                {
                  "locale": "ta_LK",
                  "value": "பங்கேற்பாளர் குழு"
                },
                {
                  "locale": "ta_MY",
                  "value": "பங்கேற்பாளர் குழு"
                },
                {
                  "locale": "ta_SG",
                  "value": "பங்கேற்பாளர் குழு"
                },
                {
                  "locale": "ur_IN",
                  "value": "شرکت کنندہ گروپ"
                },
                {
                  "locale": "ur_PK",
                  "value": "شریک کار گروپ"
                },
                {
                  "locale": "vi_VN",
                  "value": "Nhóm tham gia"
                },
                {
                  "locale": "xh_ZA",
                  "value": "Iqela Lomthathi-nxaxheba"
                },
                {
                  "locale": "zh_Hans_CN",
                  "value": "参与者组"
                },
                {
                  "locale": "zh_Hans_MY",
                  "value": "参与者组"
                },
                {
                  "locale": "zh_Hans_SG",
                  "value": "参与者组"
                },
                {
                  "locale": "zh_Hant_HK",
                  "value": "參與者組"
                },
                {
                  "locale": "zh_Hant_TW",
                  "value": "參與者群組"
                },
                {
                  "locale": "ar_EG",
                  "value": "مجموعة المشاركين"
                },
                {
                  "locale": "es_PR",
                  "value": "Grupo de participantes"
                },
                {
                  "locale": "es_PA",
                  "value": "Grupo de participantes"
                }
              ],
              "objectTypes": []
            },
            "localized": true,
            "name": "c_group",
            "object": "object",
            "objectTypes": [],
            "properties": [
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "description": "A human friendly description of the group, for display in study builder.",
                "history": false,
                "indexed": false,
                "label": "Description",
                "localization": {
                  "acl": [],
                  "aclOverride": false,
                  "enabled": false,
                  "fallback": true,
                  "fixed": "",
                  "readAccess": "read",
                  "strict": true,
                  "valid": [],
                  "writeAccess": "update"
                },
                "lowercase": false,
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_description",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "trim": false,
                "type": "String",
                "unique": false,
                "uniqueValues": false,
                "uppercase": false,
                "validators": [
                  {
                    "definition": {
                      "min": 0,
                      "max": 512
                    },
                    "name": "string"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [
                  {
                    "type": "static",
                    "value": false
                  }
                ],
                "dependencies": [],
                "history": false,
                "indexed": true,
                "label": "Display in Invite List",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_display_in_invite_list",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "type": "Boolean",
                "unique": false,
                "uniqueValues": false,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "accessTransforms": [],
                "acl": [],
                "aclOverride": false,
                "creatable": false,
                "createAcl": [
                  "role.administrator"
                ],
                "createAclOverride": false,
                "defaultAcl": [
                  "account.public.read",
                  "owner.delete",
                  "role.administrator.delete"
                ],
                "defaultAclOverride": false,
                "defaultLimit": 0,
                "defaultValue": [],
                "dependencies": [
                  "_id"
                ],
                "grant": "none",
                "hoistList": false,
                "implicitCreateAccessLevel": null,
                "inheritInstanceRoles": true,
                "inheritPropertyAccess": false,
                "label": "Task Assignments",
                "linkedReferences": [],
                "name": "c_group_tasks",
                "optional": false,
                "readAccess": "read",
                "readThrough": true,
                "readable": true,
                "removable": false,
                "roles": [],
                "skipAcl": false,
                "sourceObject": "c_group_task",
                "type": "List",
                "uniqueValues": false,
                "updateOnWriteThrough": true,
                "validators": [],
                "where": "{\"c_group\": \"{{input._id}}\"}",
                "writeAccess": "update",
                "writeThrough": true
              }
            ],
            "reporting": {
              "enabled": false
            },
            "shareAcl": [],
            "shareChain": [
              "share",
              "read",
              "connected"
            ],
            "validateOwner": true
          },
          {
            "allowConnections": true,
            "auditing": {
              "enabled": true
            },
            "canCascadeDelete": false,
            "connectionOptions": {
              "requireAccept": true,
              "requiredAccess": 5,
              "sendNotifications": true
            },
            "createAcl": [
              "role.administrator"
            ],
            "defaultAcl": [
              "owner.delete",
              "role.administrator.delete"
            ],
            "description": "An object representing a task assigned to a group in Axon",
            "favorite": false,
            "hasETag": false,
            "hasOwner": true,
            "isDeletable": true,
            "isUnmanaged": false,
            "isVersioned": false,
            "label": "Participant Group Task",
            "locales": {
              "description": [
                {
                  "locale": "en_US",
                  "value": "An object representing a task assigned to a group in Axon"
                }
              ],
              "label": [
                {
                  "locale": "en_US",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "af_ZA",
                  "value": "Deelnemer Groep Taak"
                },
                {
                  "locale": "ar_SA",
                  "value": "مهمة مجموعة المشاركين"
                },
                {
                  "locale": "bg_BG",
                  "value": "Задача за група участници"
                },
                {
                  "locale": "cs_CZ",
                  "value": "Úkol pro skupinu účastníků"
                },
                {
                  "locale": "da_DK",
                  "value": "Deltager-gruppeopgave"
                },
                {
                  "locale": "de_CH",
                  "value": "Aufgabe für Teilnehmergruppe"
                },
                {
                  "locale": "de_DE",
                  "value": "Aufgabe für Teilnehmergruppe"
                },
                {
                  "locale": "el_GR",
                  "value": "Εργασία ομάδας συμμετεχόντων"
                },
                {
                  "locale": "es_ES",
                  "value": "Tarea de grupo de participantes"
                },
                {
                  "locale": "es_MX",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "es_US",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "fr_BE",
                  "value": "Tâche Groupe de participants"
                },
                {
                  "locale": "fr_CA",
                  "value": "Tâche du groupe de participants"
                },
                {
                  "locale": "fr_CH",
                  "value": "Tâche Groupe de participants"
                },
                {
                  "locale": "fr_FR",
                  "value": "Tâche Groupe de participants"
                },
                {
                  "locale": "he_IL",
                  "value": "משימת קבוצת משתתפים"
                },
                {
                  "locale": "hu_HU",
                  "value": "Résztvevői csoportfeladat"
                },
                {
                  "locale": "it_IT",
                  "value": "Attività gruppo di partecipanti"
                },
                {
                  "locale": "ja_JP",
                  "value": "参加者グループ タスク"
                },
                {
                  "locale": "ka_GE",
                  "value": "მონაწილის ჯგუფის დავალება"
                },
                {
                  "locale": "ko_KR",
                  "value": "참가자 그룹 태스크"
                },
                {
                  "locale": "lt_LT",
                  "value": "Dalyvių grupės užduotis"
                },
                {
                  "locale": "lv_LV",
                  "value": "Dalības grupas uzdevums"
                },
                {
                  "locale": "ms_MY",
                  "value": "Tugasan Kumpulan Peserta"
                },
                {
                  "locale": "nl_BE",
                  "value": "Groepsopdracht deelnemer"
                },
                {
                  "locale": "nl_NL",
                  "value": "Taak deelnemersgroep"
                },
                {
                  "locale": "pl_PL",
                  "value": "Zadanie grupowe uczestnika"
                },
                {
                  "locale": "pt_BR",
                  "value": "Tarefa do grupo de participantes"
                },
                {
                  "locale": "pt_PT",
                  "value": "Tarefa do grupo de participantes"
                },
                {
                  "locale": "ro_RO",
                  "value": "Sarcină grup participant"
                },
                {
                  "locale": "ru_RU",
                  "value": "Задача группы участников"
                },
                {
                  "locale": "ru_UA",
                  "value": "Задача группы участников"
                },
                {
                  "locale": "sk_SK",
                  "value": "Úloha skupiny účastníkov"
                },
                {
                  "locale": "sr_Latn_RS",
                  "value": "Zadatak grupe učesnika"
                },
                {
                  "locale": "st_ZA",
                  "value": "Mosebetsi wa Sehlopha sa Bankakarolo"
                },
                {
                  "locale": "sv_SE",
                  "value": "Deltagargruppuppgift"
                },
                {
                  "locale": "tr_TR",
                  "value": "Katılımcı Grubu Görevi"
                },
                {
                  "locale": "uk_UA",
                  "value": "Група завдань учасника"
                },
                {
                  "locale": "zh_CN",
                  "value": "参与者群组任务"
                },
                {
                  "locale": "zh_TW",
                  "value": "參與者組群任務"
                },
                {
                  "locale": "zu_ZA",
                  "value": "Umsebenzi Weqembu Lababambiqhaza"
                },
                {
                  "locale": "gu_IN",
                  "value": "સહભાગી જૂથ કાર્ય"
                },
                {
                  "locale": "hi_IN",
                  "value": "प्रतिभागी समूह कार्य"
                },
                {
                  "locale": "kn_IN",
                  "value": "ಭಾಗಿಯ ಗುಂಪು ಕಾರ್ಯ"
                },
                {
                  "locale": "ml_IN",
                  "value": "പങ്കെടുക്കുന്നവരുടെ ഗ്രൂപ്പ് ടാസ്ക്"
                },
                {
                  "locale": "mr_IN",
                  "value": "सहभागी गट कार्य"
                },
                {
                  "locale": "or_IN",
                  "value": "ଅଂଶଗ୍ରହଣକାରୀ ଗୋଷ୍ଠୀ କାର୍ଯ୍ୟ"
                },
                {
                  "locale": "pa_IN",
                  "value": "ਭਾਗੀਦਾਰ ਸਮੂਹ ਟਾਸਕ"
                },
                {
                  "locale": "ta_IN",
                  "value": "பங்கேற்பாளர் குழுப் பணி"
                },
                {
                  "locale": "te_IN",
                  "value": "పాల్గొనేవారి గ్రూపు టాస్క్"
                },
                {
                  "locale": "th_TH",
                  "value": "งานของกลุ่มผู้เข้าร่วมการวิจัย"
                },
                {
                  "locale": "bn_IN",
                  "value": "অংশগ্রহণকারী দল কাজ"
                },
                {
                  "locale": "ceb_PH",
                  "value": "Buluhaton sa Grupo sa Sumasalmot"
                },
                {
                  "locale": "de_AT",
                  "value": "Aufgabe für Teilnehmergruppe"
                },
                {
                  "locale": "en_AU",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_CA",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_GB",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_NZ",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "hr_HR",
                  "value": "Zadatak skupine ispitanika"
                },
                {
                  "locale": "sl_SI",
                  "value": "Naloga skupine udeležencev"
                },
                {
                  "locale": "sr_Cyrl_RS",
                  "value": "Задатак групе учесника"
                },
                {
                  "locale": "sr_Latn",
                  "value": "Zadaci grupe učesnika"
                },
                {
                  "locale": "tl_PH",
                  "value": "Gawain ng Kalahok na Grupo"
                },
                {
                  "locale": "ar_DZ",
                  "value": "مهمة مجموعة المشاركين"
                },
                {
                  "locale": "ar_IL",
                  "value": "مهمة مجموعة المشاركين"
                },
                {
                  "locale": "ar_LB",
                  "value": "مهمة مجموعة المشاركين"
                },
                {
                  "locale": "as_IN",
                  "value": "অংশগ্ৰহণকাৰী গ্ৰুপ টাস্ক"
                },
                {
                  "locale": "ca_ES",
                  "value": "Tasca del grup participant"
                },
                {
                  "locale": "de_BE",
                  "value": "Aufgabe für Teilnehmergruppe"
                },
                {
                  "locale": "en_BE",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_HK",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_IE",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_IL",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_IN",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_JM",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_MY",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_PH",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_SG",
                  "value": "Participant Group Task"
                },
                {
                  "locale": "en_ZA",
                  "value": "Participant group task"
                },
                {
                  "locale": "es_419",
                  "value": "Tarea de Grupo Participante"
                },
                {
                  "locale": "es_AR",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "es_CL",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "es_CO",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "es_GT",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "es_PE",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "et_EE",
                  "value": "Osalejate rühma ülesanne"
                },
                {
                  "locale": "fi_FI",
                  "value": "Osallistujaryhmän tehtävä"
                },
                {
                  "locale": "fil_PH",
                  "value": "Gawain ng Grupo ng Kalahok"
                },
                {
                  "locale": "fr_DZ",
                  "value": "Tâche Groupe de participants"
                },
                {
                  "locale": "gl_ES",
                  "value": "Tarefa do grupo participante"
                },
                {
                  "locale": "it_CH",
                  "value": "Attività gruppo di partecipanti"
                },
                {
                  "locale": "ms_Arab_MY",
                  "value": "Tugas Kumpulan Peserta"
                },
                {
                  "locale": "ms_Latn_MY",
                  "value": "Tugas Kumpulan Peserta"
                },
                {
                  "locale": "ms_Latn_SG",
                  "value": "Tugas Kumpulan Peserta"
                },
                {
                  "locale": "nn_NO",
                  "value": "Deltakergruppeoppgave"
                },
                {
                  "locale": "nso_ZA",
                  "value": "Modiro wa Sehlopa sa Motšeakarolo"
                },
                {
                  "locale": "pa_Guru_IN",
                  "value": "ਭਾਗੀਦਾਰ ਸਮੂਹ ਕਾਰਜ"
                },
                {
                  "locale": "ro_MD",
                  "value": "Sarcină grup participant"
                },
                {
                  "locale": "ru_EE",
                  "value": "Задача группы участников"
                },
                {
                  "locale": "ru_IL",
                  "value": "Задача группы участников"
                },
                {
                  "locale": "ru_LT",
                  "value": "Задача группы участников"
                },
                {
                  "locale": "ru_LV",
                  "value": "Задача группы участников"
                },
                {
                  "locale": "si_LK",
                  "value": "සහභාගිවන්නාගේ කණ්ඩායම් කාර්යයන්"
                },
                {
                  "locale": "sv_FI",
                  "value": "Gruppuppgift för deltagare"
                },
                {
                  "locale": "ta_LK",
                  "value": "பங்கேற்பாளர் குழு பணி"
                },
                {
                  "locale": "ta_MY",
                  "value": "பங்கேற்பாளர் குழு பணி"
                },
                {
                  "locale": "ta_SG",
                  "value": "பங்கேற்பாளர் குழு பணி"
                },
                {
                  "locale": "ur_IN",
                  "value": "شرکت کنندہ گروپ کا ٹاسک"
                },
                {
                  "locale": "ur_PK",
                  "value": "شریک کار گروپ ٹاسک"
                },
                {
                  "locale": "vi_VN",
                  "value": "Nhiệm vụ của nhóm người tham gia"
                },
                {
                  "locale": "xh_ZA",
                  "value": "Umsebenzi Weqela Lomthathi-nxaxheba"
                },
                {
                  "locale": "zh_Hans_CN",
                  "value": "参与者组任务"
                },
                {
                  "locale": "zh_Hans_MY",
                  "value": "参与者组任务"
                },
                {
                  "locale": "zh_Hans_SG",
                  "value": "参与者组任务"
                },
                {
                  "locale": "zh_Hant_HK",
                  "value": "參與者組任務"
                },
                {
                  "locale": "zh_Hant_TW",
                  "value": "參與者群組任務"
                },
                {
                  "locale": "ar_EG",
                  "value": "مهمة مجموعة المشاركين"
                },
                {
                  "locale": "es_PR",
                  "value": "Tarea del grupo de participantes"
                },
                {
                  "locale": "es_PA",
                  "value": "Tarea del grupo de participantes"
                }
              ],
              "objectTypes": []
            },
            "localized": true,
            "name": "c_group_task",
            "object": "object",
            "objectTypes": [],
            "properties": [
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "dateOnly": true,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "End Date",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_end_date",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "type": "Date",
                "unique": false,
                "uniqueValues": false,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "autoGenerate": true,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": true,
                "label": "Key",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_key",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "type": "UUID",
                "unique": true,
                "uniqueValues": false,
                "uuidVersion": 4,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Notification Active",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_notification_active",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "type": "Boolean",
                "unique": false,
                "uniqueValues": false,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Notification Message",
                "localization": {
                  "acl": [],
                  "aclOverride": false,
                  "enabled": true,
                  "fallback": true,
                  "fixed": "",
                  "readAccess": "read",
                  "strict": true,
                  "valid": [],
                  "writeAccess": "update"
                },
                "lowercase": false,
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_notification_message",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "trim": false,
                "type": "String",
                "unique": false,
                "uniqueValues": false,
                "uppercase": false,
                "validators": [
                  {
                    "definition": {
                      "min": 0,
                      "max": 512
                    },
                    "name": "string"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Notification Skip",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_notification_skip",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "type": "Number",
                "unique": false,
                "uniqueValues": false,
                "validators": [
                  {
                    "definition": {
                      "allowDecimal": false
                    },
                    "name": "number"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": true,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Notification Times",
                "localization": {
                  "acl": [],
                  "aclOverride": false,
                  "enabled": false,
                  "fallback": true,
                  "fixed": "",
                  "readAccess": "read",
                  "strict": true,
                  "valid": [],
                  "writeAccess": "update"
                },
                "lowercase": false,
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_notification_times",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "trim": false,
                "type": "String",
                "unique": false,
                "uniqueValues": false,
                "uppercase": false,
                "validators": [
                  {
                    "definition": {
                      "min": 0,
                      "max": 512
                    },
                    "name": "string"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": true,
                "label": "Order",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_order",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "type": "Number",
                "unique": false,
                "uniqueValues": false,
                "validators": [
                  {
                    "definition": {
                      "allowDecimal": true
                    },
                    "name": "number"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": true,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "cascadeDelete": false,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Required Reviews",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_required_reviews",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "type": "ObjectId",
                "unique": false,
                "uniqueValues": false,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": true,
                "label": "Schedule Type",
                "localization": {
                  "acl": [],
                  "aclOverride": false,
                  "enabled": false,
                  "fallback": true,
                  "fixed": "",
                  "readAccess": "read",
                  "strict": true,
                  "valid": [],
                  "writeAccess": "update"
                },
                "lowercase": false,
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_schedule",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "trim": false,
                "type": "String",
                "unique": false,
                "uniqueValues": false,
                "uppercase": false,
                "validators": [
                  {
                    "definition": {
                      "min": 0,
                      "max": 512
                    },
                    "name": "string"
                  },
                  {
                    "name": "required"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "dateOnly": true,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Start Date",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_start_date",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": true,
                "type": "Date",
                "unique": false,
                "uniqueValues": false,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [
                  {
                    "type": "static",
                    "value": false
                  }
                ],
                "dependencies": [],
                "history": false,
                "indexed": true,
                "label": "Use Time Window",
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_use_time_window",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "type": "Boolean",
                "unique": false,
                "uniqueValues": false,
                "validators": [],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Window End",
                "localization": {
                  "acl": [],
                  "aclOverride": false,
                  "enabled": false,
                  "fallback": true,
                  "fixed": "",
                  "readAccess": "read",
                  "strict": true,
                  "valid": [],
                  "writeAccess": "update"
                },
                "lowercase": false,
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_window_end",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "trim": false,
                "type": "String",
                "unique": false,
                "uniqueValues": false,
                "uppercase": false,
                "validators": [
                  {
                    "definition": {
                      "pattern": "/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/",
                      "allowNull": false,
                      "allowEmpty": false
                    },
                    "name": "pattern"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              },
              {
                "acl": [],
                "aclOverride": false,
                "array": false,
                "auditable": false,
                "canPull": true,
                "canPush": true,
                "creatable": false,
                "defaultValue": [],
                "dependencies": [],
                "history": false,
                "indexed": false,
                "label": "Window Start",
                "localization": {
                  "acl": [],
                  "aclOverride": false,
                  "enabled": false,
                  "fallback": true,
                  "fixed": "",
                  "readAccess": "read",
                  "strict": true,
                  "valid": [],
                  "writeAccess": "update"
                },
                "lowercase": false,
                "maxItems": 100,
                "maxShift": false,
                "minItems": 0,
                "name": "c_window_start",
                "optional": false,
                "readAccess": "read",
                "readable": true,
                "removable": false,
                "trim": false,
                "type": "String",
                "unique": false,
                "uniqueValues": false,
                "uppercase": false,
                "validators": [
                  {
                    "definition": {
                      "pattern": "/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/",
                      "allowNull": false,
                      "allowEmpty": false
                    },
                    "name": "pattern"
                  }
                ],
                "writable": true,
                "writeAccess": "update",
                "writeOnCreate": true
              }
            ],
            "reporting": {
              "enabled": false
            },
            "shareAcl": [],
            "shareChain": [
              "share",
              "read",
              "connected"
            ],
            "validateOwner": true
          }
    ]
}