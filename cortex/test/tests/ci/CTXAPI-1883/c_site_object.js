module.exports = {
  'allowConnections': true,
  'auditing': {
    'enabled': true
  },
  'canCascadeDelete': false,
  'connectionOptions': {
    'requireAccept': false,
    'requiredAccess': 5,
    'sendNotifications': false
  },
  'createAcl': [
    'role.administrator'
  ],
  'defaultAcl': [
    'owner.delete',
    'role.administrator.delete'
  ],
  'description': 'An object representing meta data on the site associated with the study in Axon.',
  'favorite': false,
  'hasETag': false,
  'hasOwner': true,
  'isDeletable': true,
  'isUnmanaged': false,
  'isVersioned': false,
  'label': 'Site',
  'locales': {
    'description': [
      {
        'locale': 'en_US',
        'value': 'An object representing meta data on the site associated with the study in Axon.'
      }
    ],
    'label': [
      {
        'locale': 'en_US',
        'value': 'Site'
      },
      {
        'locale': 'af_ZA',
        'value': 'Sentrum'
      },
      {
        'locale': 'ar_SA',
        'value': 'الموقع'
      },
      {
        'locale': 'bg_BG',
        'value': 'Център'
      },
      {
        'locale': 'cs_CZ',
        'value': 'Pracoviště'
      },
      {
        'locale': 'da_DK',
        'value': 'Center'
      },
      {
        'locale': 'de_CH',
        'value': 'Prüfzentrum'
      },
      {
        'locale': 'de_DE',
        'value': 'Prüfzentrum'
      },
      {
        'locale': 'el_GR',
        'value': 'Κέντρο'
      },
      {
        'locale': 'es_ES',
        'value': 'Centro'
      },
      {
        'locale': 'es_MX',
        'value': 'Centro'
      },
      {
        'locale': 'es_US',
        'value': 'Centro'
      },
      {
        'locale': 'fr_BE',
        'value': 'Site'
      },
      {
        'locale': 'fr_CA',
        'value': 'Site'
      },
      {
        'locale': 'fr_CH',
        'value': 'Site'
      },
      {
        'locale': 'fr_FR',
        'value': 'Site'
      },
      {
        'locale': 'he_IL',
        'value': 'מרכז מחקר'
      },
      {
        'locale': 'hu_HU',
        'value': 'Vizsgálóhely'
      },
      {
        'locale': 'it_IT',
        'value': 'Sito'
      },
      {
        'locale': 'ja_JP',
        'value': '治験実施施設'
      },
      {
        'locale': 'ka_GE',
        'value': 'ცენტრი'
      },
      {
        'locale': 'ko_KR',
        'value': '시험기관'
      },
      {
        'locale': 'lt_LT',
        'value': 'Tyrimo centras'
      },
      {
        'locale': 'lv_LV',
        'value': 'Pētījuma centrs'
      },
      {
        'locale': 'ms_MY',
        'value': 'Laman Web'
      },
      {
        'locale': 'nl_BE',
        'value': 'Onderzoekscentrum'
      },
      {
        'locale': 'nl_NL',
        'value': 'Onderzoekscentrum'
      },
      {
        'locale': 'pl_PL',
        'value': 'Lokalizacja'
      },
      {
        'locale': 'pt_BR',
        'value': 'Centro'
      },
      {
        'locale': 'pt_PT',
        'value': 'Centro'
      },
      {
        'locale': 'ro_RO',
        'value': 'Site'
      },
      {
        'locale': 'ru_RU',
        'value': 'Исследовательский центр'
      },
      {
        'locale': 'ru_UA',
        'value': 'Исследовательский центр'
      },
      {
        'locale': 'sk_SK',
        'value': 'Pracovisko'
      },
      {
        'locale': 'sr_Latn_RS',
        'value': 'Centar'
      },
      {
        'locale': 'st_ZA',
        'value': 'Saete'
      },
      {
        'locale': 'sv_SE',
        'value': 'Inrättning'
      },
      {
        'locale': 'tr_TR',
        'value': 'Alan'
      },
      {
        'locale': 'uk_UA',
        'value': 'Місце проведення випробування'
      },
      {
        'locale': 'zh_CN',
        'value': '站点'
      },
      {
        'locale': 'zh_TW',
        'value': '試驗單位'
      },
      {
        'locale': 'zu_ZA',
        'value': 'Isayithi'
      },
      {
        'locale': 'gu_IN',
        'value': 'સાઈટ'
      },
      {
        'locale': 'hi_IN',
        'value': 'साइट'
      },
      {
        'locale': 'kn_IN',
        'value': 'ತಾಣ'
      },
      {
        'locale': 'ml_IN',
        'value': 'സൈറ്റ്'
      },
      {
        'locale': 'mr_IN',
        'value': 'साईट'
      },
      {
        'locale': 'or_IN',
        'value': 'ସାଇଟ୍'
      },
      {
        'locale': 'pa_IN',
        'value': 'ਸਾਈਟ'
      },
      {
        'locale': 'ta_IN',
        'value': 'தலம்'
      },
      {
        'locale': 'te_IN',
        'value': 'సైట్'
      },
      {
        'locale': 'th_TH',
        'value': 'ศูนย์วิจัย'
      },
      {
        'locale': 'bn_IN',
        'value': 'অধ্যয়নস্থল'
      },
      {
        'locale': 'ceb_PH',
        'value': 'Site'
      },
      {
        'locale': 'de_AT',
        'value': 'Prüfzentrum'
      },
      {
        'locale': 'en_AU',
        'value': 'Site'
      },
      {
        'locale': 'en_CA',
        'value': 'Site'
      },
      {
        'locale': 'en_GB',
        'value': 'Site'
      },
      {
        'locale': 'en_NZ',
        'value': 'Site'
      },
      {
        'locale': 'hr_HR',
        'value': 'Centar'
      },
      {
        'locale': 'sl_SI',
        'value': 'Ustanova'
      },
      {
        'locale': 'sr_Cyrl_RS',
        'value': 'Центар'
      },
      {
        'locale': 'sr_Latn',
        'value': 'Sajt'
      },
      {
        'locale': 'tl_PH',
        'value': 'Site'
      },
      {
        'locale': 'ar_DZ',
        'value': 'موقع'
      },
      {
        'locale': 'ar_IL',
        'value': 'موقع'
      },
      {
        'locale': 'ar_LB',
        'value': 'موقع'
      },
      {
        'locale': 'as_IN',
        'value': 'ছাইট'
      },
      {
        'locale': 'ca_ES',
        'value': 'Centre'
      },
      {
        'locale': 'de_BE',
        'value': 'Prüfzentrum'
      },
      {
        'locale': 'en_BE',
        'value': 'Site'
      },
      {
        'locale': 'en_HK',
        'value': 'Site'
      },
      {
        'locale': 'en_IE',
        'value': 'Site'
      },
      {
        'locale': 'en_IL',
        'value': 'Site'
      },
      {
        'locale': 'en_IN',
        'value': 'Site'
      },
      {
        'locale': 'en_JM',
        'value': 'Site'
      },
      {
        'locale': 'en_MY',
        'value': 'Site'
      },
      {
        'locale': 'en_PH',
        'value': 'Site'
      },
      {
        'locale': 'en_SG',
        'value': 'Site'
      },
      {
        'locale': 'en_ZA',
        'value': 'Site'
      },
      {
        'locale': 'es_419',
        'value': 'Sitio'
      },
      {
        'locale': 'es_AR',
        'value': 'Centro'
      },
      {
        'locale': 'es_CL',
        'value': 'Centro'
      },
      {
        'locale': 'es_CO',
        'value': 'Centro'
      },
      {
        'locale': 'es_GT',
        'value': 'Centro'
      },
      {
        'locale': 'es_PE',
        'value': 'Centro'
      },
      {
        'locale': 'et_EE',
        'value': 'Keskus'
      },
      {
        'locale': 'fi_FI',
        'value': 'Paikka'
      },
      {
        'locale': 'fil_PH',
        'value': 'Site'
      },
      {
        'locale': 'fr_DZ',
        'value': 'Site'
      },
      {
        'locale': 'gl_ES',
        'value': 'Centro'
      },
      {
        'locale': 'it_CH',
        'value': 'Centro'
      },
      {
        'locale': 'ms_Arab_MY',
        'value': 'تاڤق'
      },
      {
        'locale': 'ms_Latn_MY',
        'value': 'Tapak'
      },
      {
        'locale': 'ms_Latn_SG',
        'value': 'Tapak'
      },
      {
        'locale': 'nn_NO',
        'value': 'Sted'
      },
      {
        'locale': 'nso_ZA',
        'value': 'Lefelo'
      },
      {
        'locale': 'pa_Guru_IN',
        'value': 'ਸਾਈਟ'
      },
      {
        'locale': 'ro_MD',
        'value': 'Site'
      },
      {
        'locale': 'ru_EE',
        'value': 'Исследовательский центр'
      },
      {
        'locale': 'ru_IL',
        'value': 'Исследовательский центр'
      },
      {
        'locale': 'ru_LT',
        'value': 'Исследовательский центр'
      },
      {
        'locale': 'ru_LV',
        'value': 'Исследовательский центр'
      },
      {
        'locale': 'si_LK',
        'value': 'අඩවිය'
      },
      {
        'locale': 'sv_FI',
        'value': 'Klinik'
      },
      {
        'locale': 'ta_LK',
        'value': 'தளம்'
      },
      {
        'locale': 'ta_MY',
        'value': 'தளம்'
      },
      {
        'locale': 'ta_SG',
        'value': 'தளம்'
      },
      {
        'locale': 'ur_IN',
        'value': 'سائٹ'
      },
      {
        'locale': 'ur_PK',
        'value': 'سائٹ'
      },
      {
        'locale': 'vi_VN',
        'value': 'Cơ sở'
      },
      {
        'locale': 'xh_ZA',
        'value': 'Isayithi'
      },
      {
        'locale': 'zh_Hans_CN',
        'value': '站点'
      },
      {
        'locale': 'zh_Hans_MY',
        'value': '研究中心'
      },
      {
        'locale': 'zh_Hans_SG',
        'value': '研究中心'
      },
      {
        'locale': 'zh_Hant_HK',
        'value': '研究中心'
      },
      {
        'locale': 'zh_Hant_TW',
        'value': '試驗單位'
      },
      {
        'locale': 'ar_EG',
        'value': 'الموقع'
      },
      {
        'locale': 'es_PR',
        'value': 'Centro'
      },
      {
        'locale': 'es_PA',
        'value': 'Centro'
      },
      {
        'locale': 'hil_PH',
        'value': 'Lugar sang Pagtuon'
      },
      {
        'locale': 'ilo_PH',
        'value': 'Lugar '
      },
      {
        'locale': 'tn_ZA',
        'value': 'Saete'
      },
      {
        'locale': 'zgh_DZ',
        'value': 'ⴰⵙⵉⵜ'
      }
    ],
    'objectTypes': [],
    'properties': [
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Addresses'
          },
          {
            'locale': 'af_ZA',
            'value': 'Adresse'
          },
          {
            'locale': 'ar_SA',
            'value': 'العناوين'
          },
          {
            'locale': 'bg_BG',
            'value': 'Адреси'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Adresy'
          },
          {
            'locale': 'da_DK',
            'value': 'Adresser'
          },
          {
            'locale': 'de_CH',
            'value': 'Adressen'
          },
          {
            'locale': 'de_DE',
            'value': 'Adressen'
          },
          {
            'locale': 'el_GR',
            'value': 'Διευθύνσεις'
          },
          {
            'locale': 'es_ES',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_MX',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_US',
            'value': 'Direcciones'
          },
          {
            'locale': 'fr_BE',
            'value': 'Adresses'
          },
          {
            'locale': 'fr_CA',
            'value': 'Adresses'
          },
          {
            'locale': 'fr_CH',
            'value': 'Adresses'
          },
          {
            'locale': 'fr_FR',
            'value': 'Adresses'
          },
          {
            'locale': 'he_IL',
            'value': 'כתובות'
          },
          {
            'locale': 'hu_HU',
            'value': 'Címek'
          },
          {
            'locale': 'it_IT',
            'value': 'Indirizzi'
          },
          {
            'locale': 'ja_JP',
            'value': '住所'
          },
          {
            'locale': 'ka_GE',
            'value': 'მისამართები'
          },
          {
            'locale': 'ko_KR',
            'value': '주소'
          },
          {
            'locale': 'lt_LT',
            'value': 'Adresai'
          },
          {
            'locale': 'lv_LV',
            'value': 'Adreses'
          },
          {
            'locale': 'ms_MY',
            'value': 'Alamat'
          },
          {
            'locale': 'nl_BE',
            'value': 'Adressen'
          },
          {
            'locale': 'nl_NL',
            'value': 'Adressen'
          },
          {
            'locale': 'pl_PL',
            'value': 'Adresy'
          },
          {
            'locale': 'pt_BR',
            'value': 'Endereços'
          },
          {
            'locale': 'pt_PT',
            'value': 'Endereços'
          },
          {
            'locale': 'ro_RO',
            'value': 'Adrese'
          },
          {
            'locale': 'ru_RU',
            'value': 'Адреса'
          },
          {
            'locale': 'ru_UA',
            'value': 'Адреса'
          },
          {
            'locale': 'sk_SK',
            'value': 'Adresy'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Adrese'
          },
          {
            'locale': 'st_ZA',
            'value': 'Diaterese'
          },
          {
            'locale': 'sv_SE',
            'value': 'Adresser'
          },
          {
            'locale': 'tr_TR',
            'value': 'Adresler'
          },
          {
            'locale': 'uk_UA',
            'value': 'Адреси'
          },
          {
            'locale': 'zh_CN',
            'value': '地址'
          },
          {
            'locale': 'zh_TW',
            'value': '地址'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Amakheli'
          },
          {
            'locale': 'gu_IN',
            'value': 'સરનામાં'
          },
          {
            'locale': 'hi_IN',
            'value': 'पते'
          },
          {
            'locale': 'kn_IN',
            'value': 'ವಿಳಾಸಗಳು'
          },
          {
            'locale': 'ml_IN',
            'value': 'വിലാസങ്ങൾ'
          },
          {
            'locale': 'mr_IN',
            'value': 'पत्ते'
          },
          {
            'locale': 'or_IN',
            'value': 'ଠିକଣାସମୂହ'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਪਤੇ'
          },
          {
            'locale': 'ta_IN',
            'value': 'முகவரிகள்'
          },
          {
            'locale': 'te_IN',
            'value': 'అడ్రసులు'
          },
          {
            'locale': 'th_TH',
            'value': 'ที่อยู่'
          },
          {
            'locale': 'bn_IN',
            'value': 'ঠিকানা'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Mga Adres'
          },
          {
            'locale': 'de_AT',
            'value': 'Adressen'
          },
          {
            'locale': 'en_AU',
            'value': 'Addresses'
          },
          {
            'locale': 'en_CA',
            'value': 'Addresses'
          },
          {
            'locale': 'en_GB',
            'value': 'Addresses'
          },
          {
            'locale': 'en_NZ',
            'value': 'Addresses'
          },
          {
            'locale': 'hr_HR',
            'value': 'Adrese'
          },
          {
            'locale': 'sl_SI',
            'value': 'Naslovi'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Адресе'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Adrese'
          },
          {
            'locale': 'tl_PH',
            'value': 'Mga Address'
          },
          {
            'locale': 'ar_DZ',
            'value': 'العناوين'
          },
          {
            'locale': 'ar_IL',
            'value': 'العناوين'
          },
          {
            'locale': 'ar_LB',
            'value': 'العناوين'
          },
          {
            'locale': 'as_IN',
            'value': 'ঠিকনাবোৰ'
          },
          {
            'locale': 'ca_ES',
            'value': 'Adreces'
          },
          {
            'locale': 'de_BE',
            'value': 'Adressen'
          },
          {
            'locale': 'en_BE',
            'value': 'Addresses'
          },
          {
            'locale': 'en_HK',
            'value': 'Addresses'
          },
          {
            'locale': 'en_IE',
            'value': 'Addresses'
          },
          {
            'locale': 'en_IL',
            'value': 'Addresses'
          },
          {
            'locale': 'en_IN',
            'value': 'Addresses'
          },
          {
            'locale': 'en_JM',
            'value': 'Addresses'
          },
          {
            'locale': 'en_MY',
            'value': 'Addresses'
          },
          {
            'locale': 'en_PH',
            'value': 'Addresses'
          },
          {
            'locale': 'en_SG',
            'value': 'Addresses'
          },
          {
            'locale': 'en_ZA',
            'value': 'Addresses'
          },
          {
            'locale': 'es_419',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_AR',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_CL',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_CO',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_GT',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_PE',
            'value': 'Direcciones'
          },
          {
            'locale': 'et_EE',
            'value': 'Aadressid'
          },
          {
            'locale': 'fi_FI',
            'value': 'Osoitteet'
          },
          {
            'locale': 'fil_PH',
            'value': 'Mga Adres'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Adresses'
          },
          {
            'locale': 'gl_ES',
            'value': 'Enderezos'
          },
          {
            'locale': 'it_CH',
            'value': 'Indirizzi'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'علامت'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Alamat'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Alamat'
          },
          {
            'locale': 'nn_NO',
            'value': 'Adresser'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Diaterese'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਪਤੇ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Adrese'
          },
          {
            'locale': 'ru_EE',
            'value': 'Адреса'
          },
          {
            'locale': 'ru_IL',
            'value': 'Адреса'
          },
          {
            'locale': 'ru_LT',
            'value': 'Адреса'
          },
          {
            'locale': 'ru_LV',
            'value': 'Адреса'
          },
          {
            'locale': 'si_LK',
            'value': 'ලිපින'
          },
          {
            'locale': 'sv_FI',
            'value': 'Adresser'
          },
          {
            'locale': 'ta_LK',
            'value': 'முகவரிகள்'
          },
          {
            'locale': 'ta_MY',
            'value': 'முகவரிகள்'
          },
          {
            'locale': 'ta_SG',
            'value': 'முகவரிகள்'
          },
          {
            'locale': 'ur_IN',
            'value': 'پتے'
          },
          {
            'locale': 'ur_PK',
            'value': 'پتے'
          },
          {
            'locale': 'vi_VN',
            'value': 'Địa chỉ'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Iidilesi'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '地址'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '地址'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '地址'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '地址'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '地址'
          },
          {
            'locale': 'ar_EG',
            'value': 'العناوين'
          },
          {
            'locale': 'es_PR',
            'value': 'Direcciones'
          },
          {
            'locale': 'es_PA',
            'value': 'Direcciones'
          },
          {
            'locale': 'hil_PH',
            'value': 'Mga Adres'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Dagiti Address'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Diaterese'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵜⴰⵏⵙⵉⵡⵉⵏ'
          }
        ],
        'name': 'c_addresses',
        'properties': [
          {
            'description': [],
            'label': [
              {
                'locale': 'en_US',
                'value': 'Key'
              },
              {
                'locale': 'af_ZA',
                'value': 'Sleutel'
              },
              {
                'locale': 'ar_SA',
                'value': 'المفتاح'
              },
              {
                'locale': 'bg_BG',
                'value': 'Ключ'
              },
              {
                'locale': 'cs_CZ',
                'value': 'Klíč'
              },
              {
                'locale': 'da_DK',
                'value': 'Nøgle'
              },
              {
                'locale': 'de_CH',
                'value': 'Schlüssel'
              },
              {
                'locale': 'de_DE',
                'value': 'Schlüssel'
              },
              {
                'locale': 'el_GR',
                'value': 'Κλειδί'
              },
              {
                'locale': 'es_ES',
                'value': 'Clave'
              },
              {
                'locale': 'es_MX',
                'value': 'Clave'
              },
              {
                'locale': 'es_US',
                'value': 'Clave'
              },
              {
                'locale': 'fr_BE',
                'value': 'Clé'
              },
              {
                'locale': 'fr_CA',
                'value': 'Clé'
              },
              {
                'locale': 'fr_CH',
                'value': 'Clé'
              },
              {
                'locale': 'fr_FR',
                'value': 'Clé'
              },
              {
                'locale': 'he_IL',
                'value': 'מפתח'
              },
              {
                'locale': 'hu_HU',
                'value': 'Kulcs'
              },
              {
                'locale': 'it_IT',
                'value': 'Chiave'
              },
              {
                'locale': 'ja_JP',
                'value': 'キー'
              },
              {
                'locale': 'ka_GE',
                'value': 'გასაღები'
              },
              {
                'locale': 'ko_KR',
                'value': '키'
              },
              {
                'locale': 'lt_LT',
                'value': 'Raktas'
              },
              {
                'locale': 'lv_LV',
                'value': 'Atslēga'
              },
              {
                'locale': 'ms_MY',
                'value': 'Kekunci'
              },
              {
                'locale': 'nl_BE',
                'value': 'Toets'
              },
              {
                'locale': 'nl_NL',
                'value': 'Sleutel'
              },
              {
                'locale': 'pl_PL',
                'value': 'Klucz'
              },
              {
                'locale': 'pt_BR',
                'value': 'Chave'
              },
              {
                'locale': 'pt_PT',
                'value': 'Chave'
              },
              {
                'locale': 'ro_RO',
                'value': 'Cheie'
              },
              {
                'locale': 'ru_RU',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_UA',
                'value': 'Ключ'
              },
              {
                'locale': 'sk_SK',
                'value': 'Kľúč'
              },
              {
                'locale': 'sr_Latn_RS',
                'value': 'Ključ'
              },
              {
                'locale': 'st_ZA',
                'value': 'Senotlolo'
              },
              {
                'locale': 'sv_SE',
                'value': 'Nyckel'
              },
              {
                'locale': 'tr_TR',
                'value': 'Anahtar'
              },
              {
                'locale': 'uk_UA',
                'value': 'Ключ'
              },
              {
                'locale': 'zh_CN',
                'value': '密钥'
              },
              {
                'locale': 'zh_TW',
                'value': '密鑰'
              },
              {
                'locale': 'zu_ZA',
                'value': 'Ukhiye'
              },
              {
                'locale': 'gu_IN',
                'value': 'કી'
              },
              {
                'locale': 'hi_IN',
                'value': 'कुंजी'
              },
              {
                'locale': 'kn_IN',
                'value': 'ಕೀಲಿ'
              },
              {
                'locale': 'ml_IN',
                'value': 'കീ'
              },
              {
                'locale': 'mr_IN',
                'value': 'की'
              },
              {
                'locale': 'or_IN',
                'value': 'କୀ'
              },
              {
                'locale': 'pa_IN',
                'value': 'ਕੁੰਜੀ'
              },
              {
                'locale': 'ta_IN',
                'value': 'முக்கிய தொகுப்பு'
              },
              {
                'locale': 'te_IN',
                'value': 'కీ'
              },
              {
                'locale': 'th_TH',
                'value': 'แก่นสำคัญ'
              },
              {
                'locale': 'bn_IN',
                'value': 'কী'
              },
              {
                'locale': 'ceb_PH',
                'value': 'Key'
              },
              {
                'locale': 'de_AT',
                'value': 'Schlüssel'
              },
              {
                'locale': 'en_AU',
                'value': 'Key'
              },
              {
                'locale': 'en_CA',
                'value': 'Key'
              },
              {
                'locale': 'en_GB',
                'value': 'Key'
              },
              {
                'locale': 'en_NZ',
                'value': 'Key'
              },
              {
                'locale': 'hr_HR',
                'value': 'Ključ'
              },
              {
                'locale': 'sl_SI',
                'value': 'Ključ'
              },
              {
                'locale': 'sr_Cyrl_RS',
                'value': 'Кључ'
              },
              {
                'locale': 'sr_Latn',
                'value': 'Ključ'
              },
              {
                'locale': 'tl_PH',
                'value': 'Key'
              },
              {
                'locale': 'ar_DZ',
                'value': 'مفتاح'
              },
              {
                'locale': 'ar_IL',
                'value': 'مفتاح'
              },
              {
                'locale': 'ar_LB',
                'value': 'مفتاح'
              },
              {
                'locale': 'as_IN',
                'value': 'কী'
              },
              {
                'locale': 'ca_ES',
                'value': 'Clau'
              },
              {
                'locale': 'de_BE',
                'value': 'Schlüssel'
              },
              {
                'locale': 'en_BE',
                'value': 'Key'
              },
              {
                'locale': 'en_HK',
                'value': 'Key'
              },
              {
                'locale': 'en_IE',
                'value': 'Key'
              },
              {
                'locale': 'en_IL',
                'value': 'Key'
              },
              {
                'locale': 'en_IN',
                'value': 'Key'
              },
              {
                'locale': 'en_JM',
                'value': 'Key'
              },
              {
                'locale': 'en_MY',
                'value': 'Key'
              },
              {
                'locale': 'en_PH',
                'value': 'Key'
              },
              {
                'locale': 'en_SG',
                'value': 'Key'
              },
              {
                'locale': 'en_ZA',
                'value': 'Key'
              },
              {
                'locale': 'es_419',
                'value': 'Clave'
              },
              {
                'locale': 'es_AR',
                'value': 'Clave'
              },
              {
                'locale': 'es_CL',
                'value': 'Clave'
              },
              {
                'locale': 'es_CO',
                'value': 'Clave'
              },
              {
                'locale': 'es_GT',
                'value': 'Clave'
              },
              {
                'locale': 'es_PE',
                'value': 'Clave'
              },
              {
                'locale': 'et_EE',
                'value': 'Võti'
              },
              {
                'locale': 'fi_FI',
                'value': 'Avain'
              },
              {
                'locale': 'fil_PH',
                'value': 'Key'
              },
              {
                'locale': 'fr_DZ',
                'value': 'Clé'
              },
              {
                'locale': 'gl_ES',
                'value': 'Clave'
              },
              {
                'locale': 'it_CH',
                'value': 'Chiave'
              },
              {
                'locale': 'ms_Arab_MY',
                'value': 'كونچي'
              },
              {
                'locale': 'ms_Latn_MY',
                'value': 'Kunci'
              },
              {
                'locale': 'ms_Latn_SG',
                'value': 'Kunci'
              },
              {
                'locale': 'nn_NO',
                'value': 'Nøkkel'
              },
              {
                'locale': 'nso_ZA',
                'value': 'Konopi'
              },
              {
                'locale': 'pa_Guru_IN',
                'value': 'ਕੁੰਜੀ'
              },
              {
                'locale': 'ro_MD',
                'value': 'Cheie'
              },
              {
                'locale': 'ru_EE',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_IL',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_LT',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_LV',
                'value': 'Ключ'
              },
              {
                'locale': 'si_LK',
                'value': 'යතුර'
              },
              {
                'locale': 'sv_FI',
                'value': 'Nyckel'
              },
              {
                'locale': 'ta_LK',
                'value': 'முக்கிய'
              },
              {
                'locale': 'ta_MY',
                'value': 'சாவி'
              },
              {
                'locale': 'ta_SG',
                'value': 'சாவி'
              },
              {
                'locale': 'ur_IN',
                'value': 'کلید'
              },
              {
                'locale': 'ur_PK',
                'value': 'کلید'
              },
              {
                'locale': 'vi_VN',
                'value': 'Chìa khóa'
              },
              {
                'locale': 'xh_ZA',
                'value': 'Isitshixo'
              },
              {
                'locale': 'zh_Hans_CN',
                'value': '关键'
              },
              {
                'locale': 'zh_Hans_MY',
                'value': '密钥'
              },
              {
                'locale': 'zh_Hans_SG',
                'value': '密钥'
              },
              {
                'locale': 'zh_Hant_HK',
                'value': '鑰匙'
              },
              {
                'locale': 'zh_Hant_TW',
                'value': '密鑰'
              },
              {
                'locale': 'ar_EG',
                'value': 'المفتاح'
              },
              {
                'locale': 'es_PR',
                'value': 'Clave'
              },
              {
                'locale': 'es_PA',
                'value': 'Clave'
              },
              {
                'locale': 'hil_PH',
                'value': 'Key'
              },
              {
                'locale': 'ilo_PH',
                'value': 'Key'
              },
              {
                'locale': 'tn_ZA',
                'value': 'Selotlolo'
              },
              {
                'locale': 'zgh_DZ',
                'value': 'ⵜⴰⵙⴰⵔⵓⵜ'
              }
            ],
            'name': 'c_key'
          },
          {
            'description': [],
            'label': [
              {
                'locale': 'en_US',
                'value': 'Line'
              },
              {
                'locale': 'af_ZA',
                'value': 'Lyn'
              },
              {
                'locale': 'ar_SA',
                'value': 'سطر'
              },
              {
                'locale': 'bg_BG',
                'value': 'Линия'
              },
              {
                'locale': 'cs_CZ',
                'value': 'Řádek'
              },
              {
                'locale': 'da_DK',
                'value': 'Linjer'
              },
              {
                'locale': 'de_CH',
                'value': 'Zeile'
              },
              {
                'locale': 'de_DE',
                'value': 'Zeile'
              },
              {
                'locale': 'el_GR',
                'value': 'Γραμμή'
              },
              {
                'locale': 'es_ES',
                'value': 'Línea'
              },
              {
                'locale': 'es_MX',
                'value': 'Línea'
              },
              {
                'locale': 'es_US',
                'value': 'Línea'
              },
              {
                'locale': 'fr_BE',
                'value': 'Ligne'
              },
              {
                'locale': 'fr_CA',
                'value': 'Ligne'
              },
              {
                'locale': 'fr_CH',
                'value': 'Ligne'
              },
              {
                'locale': 'fr_FR',
                'value': 'Ligne'
              },
              {
                'locale': 'he_IL',
                'value': 'קו'
              },
              {
                'locale': 'hu_HU',
                'value': 'Sor'
              },
              {
                'locale': 'it_IT',
                'value': 'Linea'
              },
              {
                'locale': 'ja_JP',
                'value': '線'
              },
              {
                'locale': 'ka_GE',
                'value': 'ხაზი'
              },
              {
                'locale': 'ko_KR',
                'value': '라인'
              },
              {
                'locale': 'lt_LT',
                'value': 'Eilutė'
              },
              {
                'locale': 'lv_LV',
                'value': 'Rinda'
              },
              {
                'locale': 'ms_MY',
                'value': 'Barisan'
              },
              {
                'locale': 'nl_BE',
                'value': 'Regel'
              },
              {
                'locale': 'nl_NL',
                'value': 'Regel'
              },
              {
                'locale': 'pl_PL',
                'value': 'Linia'
              },
              {
                'locale': 'pt_BR',
                'value': 'Linha'
              },
              {
                'locale': 'pt_PT',
                'value': 'Linha'
              },
              {
                'locale': 'ro_RO',
                'value': 'Linie'
              },
              {
                'locale': 'ru_RU',
                'value': 'Линия'
              },
              {
                'locale': 'ru_UA',
                'value': 'Линия'
              },
              {
                'locale': 'sk_SK',
                'value': 'Riadok'
              },
              {
                'locale': 'sr_Latn_RS',
                'value': 'Linija'
              },
              {
                'locale': 'st_ZA',
                'value': 'Mola'
              },
              {
                'locale': 'sv_SE',
                'value': 'Linje'
              },
              {
                'locale': 'tr_TR',
                'value': 'Satır'
              },
              {
                'locale': 'uk_UA',
                'value': 'Рядок'
              },
              {
                'locale': 'zh_CN',
                'value': '线路'
              },
              {
                'locale': 'zh_TW',
                'value': '線'
              },
              {
                'locale': 'zu_ZA',
                'value': 'Umugqa'
              },
              {
                'locale': 'gu_IN',
                'value': 'લાઇન'
              },
              {
                'locale': 'hi_IN',
                'value': 'पंक्ति'
              },
              {
                'locale': 'kn_IN',
                'value': 'ಸಾಲು'
              },
              {
                'locale': 'ml_IN',
                'value': 'ലൈൻ'
              },
              {
                'locale': 'mr_IN',
                'value': 'लाईन'
              },
              {
                'locale': 'or_IN',
                'value': 'ଲାଇନ୍'
              },
              {
                'locale': 'pa_IN',
                'value': 'ਲਾਈਨ'
              },
              {
                'locale': 'ta_IN',
                'value': 'வரிசை'
              },
              {
                'locale': 'te_IN',
                'value': 'లైన్'
              },
              {
                'locale': 'th_TH',
                'value': 'บรรทัด'
              },
              {
                'locale': 'bn_IN',
                'value': 'লাইন'
              },
              {
                'locale': 'ceb_PH',
                'value': 'Linya'
              },
              {
                'locale': 'de_AT',
                'value': 'Zeile'
              },
              {
                'locale': 'en_AU',
                'value': 'Line'
              },
              {
                'locale': 'en_CA',
                'value': 'Line'
              },
              {
                'locale': 'en_GB',
                'value': 'Line'
              },
              {
                'locale': 'en_NZ',
                'value': 'Line'
              },
              {
                'locale': 'hr_HR',
                'value': 'Redak'
              },
              {
                'locale': 'sl_SI',
                'value': 'Linija'
              },
              {
                'locale': 'sr_Cyrl_RS',
                'value': 'Линија'
              },
              {
                'locale': 'sr_Latn',
                'value': 'Linija'
              },
              {
                'locale': 'tl_PH',
                'value': 'Linya'
              },
              {
                'locale': 'ar_DZ',
                'value': 'سطر'
              },
              {
                'locale': 'ar_IL',
                'value': 'سطر'
              },
              {
                'locale': 'ar_LB',
                'value': 'سطر'
              },
              {
                'locale': 'as_IN',
                'value': 'লাইন'
              },
              {
                'locale': 'ca_ES',
                'value': 'Línia'
              },
              {
                'locale': 'de_BE',
                'value': 'Zeile'
              },
              {
                'locale': 'en_BE',
                'value': 'Line'
              },
              {
                'locale': 'en_HK',
                'value': 'Line'
              },
              {
                'locale': 'en_IE',
                'value': 'Line'
              },
              {
                'locale': 'en_IL',
                'value': 'Line'
              },
              {
                'locale': 'en_IN',
                'value': 'Line'
              },
              {
                'locale': 'en_JM',
                'value': 'Line'
              },
              {
                'locale': 'en_MY',
                'value': 'Line'
              },
              {
                'locale': 'en_PH',
                'value': 'Line'
              },
              {
                'locale': 'en_SG',
                'value': 'Line'
              },
              {
                'locale': 'en_ZA',
                'value': 'Line'
              },
              {
                'locale': 'es_419',
                'value': 'Línea'
              },
              {
                'locale': 'es_AR',
                'value': 'Línea'
              },
              {
                'locale': 'es_CL',
                'value': 'Línea'
              },
              {
                'locale': 'es_CO',
                'value': 'Línea'
              },
              {
                'locale': 'es_GT',
                'value': 'Línea'
              },
              {
                'locale': 'es_PE',
                'value': 'Línea'
              },
              {
                'locale': 'et_EE',
                'value': 'Rida'
              },
              {
                'locale': 'fi_FI',
                'value': 'Linja'
              },
              {
                'locale': 'fil_PH',
                'value': 'Linya'
              },
              {
                'locale': 'fr_DZ',
                'value': 'Ligne'
              },
              {
                'locale': 'gl_ES',
                'value': 'Fila'
              },
              {
                'locale': 'it_CH',
                'value': 'Linea'
              },
              {
                'locale': 'ms_Arab_MY',
                'value': 'تالين'
              },
              {
                'locale': 'ms_Latn_MY',
                'value': 'Baris'
              },
              {
                'locale': 'ms_Latn_SG',
                'value': 'Baris'
              },
              {
                'locale': 'nn_NO',
                'value': 'Linje'
              },
              {
                'locale': 'nso_ZA',
                'value': 'Mothaladi'
              },
              {
                'locale': 'pa_Guru_IN',
                'value': 'ਰੇਖਾ'
              },
              {
                'locale': 'ro_MD',
                'value': 'Linie'
              },
              {
                'locale': 'ru_EE',
                'value': 'Линия'
              },
              {
                'locale': 'ru_IL',
                'value': 'Линия'
              },
              {
                'locale': 'ru_LT',
                'value': 'Линия'
              },
              {
                'locale': 'ru_LV',
                'value': 'Линия'
              },
              {
                'locale': 'si_LK',
                'value': 'රේඛාව'
              },
              {
                'locale': 'sv_FI',
                'value': 'Linje'
              },
              {
                'locale': 'ta_LK',
                'value': 'வரை'
              },
              {
                'locale': 'ta_MY',
                'value': 'கோடு'
              },
              {
                'locale': 'ta_SG',
                'value': 'கோடு'
              },
              {
                'locale': 'ur_IN',
                'value': 'لائن'
              },
              {
                'locale': 'ur_PK',
                'value': 'لائن'
              },
              {
                'locale': 'vi_VN',
                'value': 'Hàng'
              },
              {
                'locale': 'xh_ZA',
                'value': 'Umngca'
              },
              {
                'locale': 'zh_Hans_CN',
                'value': '行'
              },
              {
                'locale': 'zh_Hans_MY',
                'value': '行'
              },
              {
                'locale': 'zh_Hans_SG',
                'value': '行'
              },
              {
                'locale': 'zh_Hant_HK',
                'value': '行'
              },
              {
                'locale': 'zh_Hant_TW',
                'value': '排隊名單'
              },
              {
                'locale': 'ar_EG',
                'value': 'سطر'
              },
              {
                'locale': 'es_PR',
                'value': 'Línea'
              },
              {
                'locale': 'es_PA',
                'value': 'Línea'
              },
              {
                'locale': 'hil_PH',
                'value': 'Linya'
              },
              {
                'locale': 'ilo_PH',
                'value': 'Linia'
              },
              {
                'locale': 'tn_ZA',
                'value': 'Mola'
              },
              {
                'locale': 'zgh_DZ',
                'value': 'ⴰⵊⴻⵔⵔⵉⴹ'
              }
            ],
            'name': 'c_line'
          },
          {
            'description': [],
            'label': [
              {
                'locale': 'en_US',
                'value': 'Type'
              },
              {
                'locale': 'af_ZA',
                'value': 'Tipe'
              },
              {
                'locale': 'ar_SA',
                'value': 'النوع'
              },
              {
                'locale': 'bg_BG',
                'value': 'Вид'
              },
              {
                'locale': 'cs_CZ',
                'value': 'Typ'
              },
              {
                'locale': 'da_DK',
                'value': 'Type'
              },
              {
                'locale': 'de_CH',
                'value': 'Typ'
              },
              {
                'locale': 'de_DE',
                'value': 'Typ'
              },
              {
                'locale': 'el_GR',
                'value': 'Τύπος'
              },
              {
                'locale': 'es_ES',
                'value': 'Tipo'
              },
              {
                'locale': 'es_MX',
                'value': 'Tipo'
              },
              {
                'locale': 'es_US',
                'value': 'Tipo'
              },
              {
                'locale': 'fr_BE',
                'value': 'Type'
              },
              {
                'locale': 'fr_CA',
                'value': 'Type'
              },
              {
                'locale': 'fr_CH',
                'value': 'Type'
              },
              {
                'locale': 'fr_FR',
                'value': 'Type'
              },
              {
                'locale': 'he_IL',
                'value': 'סוג'
              },
              {
                'locale': 'hu_HU',
                'value': 'Típus'
              },
              {
                'locale': 'it_IT',
                'value': 'Tipo'
              },
              {
                'locale': 'ja_JP',
                'value': 'タイプ'
              },
              {
                'locale': 'ka_GE',
                'value': 'ტიპი'
              },
              {
                'locale': 'ko_KR',
                'value': '유형'
              },
              {
                'locale': 'lt_LT',
                'value': 'Tipas'
              },
              {
                'locale': 'lv_LV',
                'value': 'Veids'
              },
              {
                'locale': 'ms_MY',
                'value': 'Jenis'
              },
              {
                'locale': 'nl_BE',
                'value': 'Type'
              },
              {
                'locale': 'nl_NL',
                'value': 'Soort'
              },
              {
                'locale': 'pl_PL',
                'value': 'Typ'
              },
              {
                'locale': 'pt_BR',
                'value': 'Tipo'
              },
              {
                'locale': 'pt_PT',
                'value': 'Tipo'
              },
              {
                'locale': 'ro_RO',
                'value': 'Tip'
              },
              {
                'locale': 'ru_RU',
                'value': 'Тип'
              },
              {
                'locale': 'ru_UA',
                'value': 'Тип'
              },
              {
                'locale': 'sk_SK',
                'value': 'Typ'
              },
              {
                'locale': 'sr_Latn_RS',
                'value': 'Tip'
              },
              {
                'locale': 'st_ZA',
                'value': 'Mofuta'
              },
              {
                'locale': 'sv_SE',
                'value': 'Typ'
              },
              {
                'locale': 'tr_TR',
                'value': 'Tür'
              },
              {
                'locale': 'uk_UA',
                'value': 'Тип'
              },
              {
                'locale': 'zh_CN',
                'value': '类型'
              },
              {
                'locale': 'zh_TW',
                'value': '類型'
              },
              {
                'locale': 'zu_ZA',
                'value': 'Uhlobo'
              },
              {
                'locale': 'gu_IN',
                'value': 'પ્રકાર'
              },
              {
                'locale': 'hi_IN',
                'value': 'प्रकार'
              },
              {
                'locale': 'kn_IN',
                'value': 'ವಿಧ'
              },
              {
                'locale': 'ml_IN',
                'value': 'ടൈപ്പ് ചെയ്യുക'
              },
              {
                'locale': 'mr_IN',
                'value': 'प्रकार'
              },
              {
                'locale': 'or_IN',
                'value': 'ପ୍ରକାର'
              },
              {
                'locale': 'pa_IN',
                'value': 'ਪ੍ਰਕਾਰ'
              },
              {
                'locale': 'ta_IN',
                'value': 'வகை'
              },
              {
                'locale': 'te_IN',
                'value': 'రకం'
              },
              {
                'locale': 'th_TH',
                'value': 'ประเภท'
              },
              {
                'locale': 'bn_IN',
                'value': 'কাজ সমাপন'
              },
              {
                'locale': 'ceb_PH',
                'value': 'Matangok'
              },
              {
                'locale': 'de_AT',
                'value': 'Typ'
              },
              {
                'locale': 'en_AU',
                'value': 'Type'
              },
              {
                'locale': 'en_CA',
                'value': 'Type'
              },
              {
                'locale': 'en_GB',
                'value': 'Type'
              },
              {
                'locale': 'en_NZ',
                'value': 'Type'
              },
              {
                'locale': 'hr_HR',
                'value': 'Vrsta'
              },
              {
                'locale': 'sl_SI',
                'value': 'Tip'
              },
              {
                'locale': 'sr_Cyrl_RS',
                'value': 'Тип'
              },
              {
                'locale': 'sr_Latn',
                'value': 'Tip'
              },
              {
                'locale': 'tl_PH',
                'value': 'Uri'
              },
              {
                'locale': 'ar_DZ',
                'value': 'النوع'
              },
              {
                'locale': 'ar_IL',
                'value': 'النوع'
              },
              {
                'locale': 'ar_LB',
                'value': 'النوع'
              },
              {
                'locale': 'as_IN',
                'value': 'প্ৰকাৰ'
              },
              {
                'locale': 'ca_ES',
                'value': 'Tipus'
              },
              {
                'locale': 'de_BE',
                'value': 'Typ'
              },
              {
                'locale': 'en_BE',
                'value': 'Type'
              },
              {
                'locale': 'en_HK',
                'value': 'Type'
              },
              {
                'locale': 'en_IE',
                'value': 'Type'
              },
              {
                'locale': 'en_IL',
                'value': 'Type'
              },
              {
                'locale': 'en_IN',
                'value': 'Type'
              },
              {
                'locale': 'en_JM',
                'value': 'Type'
              },
              {
                'locale': 'en_MY',
                'value': 'Type'
              },
              {
                'locale': 'en_PH',
                'value': 'Type'
              },
              {
                'locale': 'en_SG',
                'value': 'Type'
              },
              {
                'locale': 'en_ZA',
                'value': 'Type'
              },
              {
                'locale': 'es_419',
                'value': 'Tipo'
              },
              {
                'locale': 'es_AR',
                'value': 'Tipo'
              },
              {
                'locale': 'es_CL',
                'value': 'Tipo'
              },
              {
                'locale': 'es_CO',
                'value': 'Tipo'
              },
              {
                'locale': 'es_GT',
                'value': 'Tipo'
              },
              {
                'locale': 'es_PE',
                'value': 'Tipo'
              },
              {
                'locale': 'et_EE',
                'value': 'Tüüp'
              },
              {
                'locale': 'fi_FI',
                'value': 'Tyyppi'
              },
              {
                'locale': 'fil_PH',
                'value': 'Uri'
              },
              {
                'locale': 'fr_DZ',
                'value': 'Type'
              },
              {
                'locale': 'gl_ES',
                'value': 'Tipo'
              },
              {
                'locale': 'it_CH',
                'value': 'Tipo'
              },
              {
                'locale': 'ms_Arab_MY',
                'value': 'جنيس'
              },
              {
                'locale': 'ms_Latn_MY',
                'value': 'Jenis'
              },
              {
                'locale': 'ms_Latn_SG',
                'value': 'Jenis'
              },
              {
                'locale': 'nn_NO',
                'value': 'Type'
              },
              {
                'locale': 'nso_ZA',
                'value': 'Mohuta'
              },
              {
                'locale': 'pa_Guru_IN',
                'value': 'ਕਿਸਮ'
              },
              {
                'locale': 'ro_MD',
                'value': 'Tip'
              },
              {
                'locale': 'ru_EE',
                'value': 'Тип'
              },
              {
                'locale': 'ru_IL',
                'value': 'Тип'
              },
              {
                'locale': 'ru_LT',
                'value': 'Тип'
              },
              {
                'locale': 'ru_LV',
                'value': 'Тип'
              },
              {
                'locale': 'si_LK',
                'value': 'වර්ගය'
              },
              {
                'locale': 'sv_FI',
                'value': 'Typ'
              },
              {
                'locale': 'ta_LK',
                'value': 'வகை'
              },
              {
                'locale': 'ta_MY',
                'value': 'வகை'
              },
              {
                'locale': 'ta_SG',
                'value': 'வகை'
              },
              {
                'locale': 'ur_IN',
                'value': 'قسم'
              },
              {
                'locale': 'ur_PK',
                'value': 'قسم'
              },
              {
                'locale': 'vi_VN',
                'value': 'Kiểu'
              },
              {
                'locale': 'xh_ZA',
                'value': 'Uhlobo'
              },
              {
                'locale': 'zh_Hans_CN',
                'value': '类型'
              },
              {
                'locale': 'zh_Hans_MY',
                'value': '类型'
              },
              {
                'locale': 'zh_Hans_SG',
                'value': '类型'
              },
              {
                'locale': 'zh_Hant_HK',
                'value': '類型'
              },
              {
                'locale': 'zh_Hant_TW',
                'value': '類型'
              },
              {
                'locale': 'ar_EG',
                'value': 'النوع'
              },
              {
                'locale': 'es_PR',
                'value': 'Tipo'
              },
              {
                'locale': 'es_PA',
                'value': 'Tipo'
              },
              {
                'locale': 'hil_PH',
                'value': 'Klase'
              },
              {
                'locale': 'ilo_PH',
                'value': 'Kita'
              },
              {
                'locale': 'tn_ZA',
                'value': 'Mofuta'
              },
              {
                'locale': 'zgh_DZ',
                'value': 'ⴰⵏⴰⵡ'
              }
            ],
            'name': 'c_type'
          }
        ]
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Contacts'
          },
          {
            'locale': 'af_ZA',
            'value': 'Kontakte'
          },
          {
            'locale': 'ar_SA',
            'value': 'جهات الاتصال'
          },
          {
            'locale': 'bg_BG',
            'value': 'Контакти'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Kontakty'
          },
          {
            'locale': 'da_DK',
            'value': 'Kontakter'
          },
          {
            'locale': 'de_CH',
            'value': 'Kontakte'
          },
          {
            'locale': 'de_DE',
            'value': 'Kontakte'
          },
          {
            'locale': 'el_GR',
            'value': 'Επαφές'
          },
          {
            'locale': 'es_ES',
            'value': 'Contactos'
          },
          {
            'locale': 'es_MX',
            'value': 'Contactos'
          },
          {
            'locale': 'es_US',
            'value': 'Contactos'
          },
          {
            'locale': 'fr_BE',
            'value': 'Contacts'
          },
          {
            'locale': 'fr_CA',
            'value': 'Contacts'
          },
          {
            'locale': 'fr_CH',
            'value': 'Contacts'
          },
          {
            'locale': 'fr_FR',
            'value': 'Contacts'
          },
          {
            'locale': 'he_IL',
            'value': 'אנשי קשר'
          },
          {
            'locale': 'hu_HU',
            'value': 'Kapcsolattartók'
          },
          {
            'locale': 'it_IT',
            'value': 'Contatti'
          },
          {
            'locale': 'ja_JP',
            'value': '連絡先'
          },
          {
            'locale': 'ka_GE',
            'value': 'კონტაქტები'
          },
          {
            'locale': 'ko_KR',
            'value': '연락처'
          },
          {
            'locale': 'lt_LT',
            'value': 'Kontaktai'
          },
          {
            'locale': 'lv_LV',
            'value': 'Kontaktpersonas'
          },
          {
            'locale': 'ms_MY',
            'value': 'Kenalan'
          },
          {
            'locale': 'nl_BE',
            'value': 'Contacten'
          },
          {
            'locale': 'nl_NL',
            'value': 'Contactpersonen'
          },
          {
            'locale': 'pl_PL',
            'value': 'Kontakty'
          },
          {
            'locale': 'pt_BR',
            'value': 'Contatos'
          },
          {
            'locale': 'pt_PT',
            'value': 'Contactos'
          },
          {
            'locale': 'ro_RO',
            'value': 'Contacte'
          },
          {
            'locale': 'ru_RU',
            'value': 'Контакты'
          },
          {
            'locale': 'ru_UA',
            'value': 'Контакты'
          },
          {
            'locale': 'sk_SK',
            'value': 'Kontakty'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Kontakti'
          },
          {
            'locale': 'st_ZA',
            'value': 'Dintlha tsa Boikopanyo'
          },
          {
            'locale': 'sv_SE',
            'value': 'Kontakter'
          },
          {
            'locale': 'tr_TR',
            'value': 'İrtibat Kişileri'
          },
          {
            'locale': 'uk_UA',
            'value': 'Контакти'
          },
          {
            'locale': 'zh_CN',
            'value': '联系人'
          },
          {
            'locale': 'zh_TW',
            'value': '聯繫人'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Abathintwayo'
          },
          {
            'locale': 'gu_IN',
            'value': 'સંપર્કો'
          },
          {
            'locale': 'hi_IN',
            'value': 'संपर्क'
          },
          {
            'locale': 'kn_IN',
            'value': 'ಸಂಪರ್ಕಗಳು'
          },
          {
            'locale': 'ml_IN',
            'value': 'ബന്ധങ്ങൾ'
          },
          {
            'locale': 'mr_IN',
            'value': 'संपर्क'
          },
          {
            'locale': 'or_IN',
            'value': 'ସମ୍ପର୍କଗୁଡିକ'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਸੰਪਰਕ'
          },
          {
            'locale': 'ta_IN',
            'value': 'தொடர்புகள்'
          },
          {
            'locale': 'te_IN',
            'value': 'పరిచయాలు'
          },
          {
            'locale': 'th_TH',
            'value': 'ผู้ติดต่อ'
          },
          {
            'locale': 'bn_IN',
            'value': 'যোগাযোগগুলি'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Mga Kontak'
          },
          {
            'locale': 'de_AT',
            'value': 'Kontakte'
          },
          {
            'locale': 'en_AU',
            'value': 'Contacts'
          },
          {
            'locale': 'en_CA',
            'value': 'Contacts'
          },
          {
            'locale': 'en_GB',
            'value': 'Contacts'
          },
          {
            'locale': 'en_NZ',
            'value': 'Contacts'
          },
          {
            'locale': 'hr_HR',
            'value': 'Kontakti'
          },
          {
            'locale': 'sl_SI',
            'value': 'Stiki'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Контакти'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Kontakti'
          },
          {
            'locale': 'tl_PH',
            'value': 'Mga Kontak'
          },
          {
            'locale': 'ar_DZ',
            'value': 'جهات الاتصال'
          },
          {
            'locale': 'ar_IL',
            'value': 'جهات الاتصال'
          },
          {
            'locale': 'ar_LB',
            'value': 'جهات الاتصال'
          },
          {
            'locale': 'as_IN',
            'value': 'যোগাযোগবোৰ'
          },
          {
            'locale': 'ca_ES',
            'value': 'Contactes'
          },
          {
            'locale': 'de_BE',
            'value': 'Kontakte'
          },
          {
            'locale': 'en_BE',
            'value': 'Contacts'
          },
          {
            'locale': 'en_HK',
            'value': 'Contacts'
          },
          {
            'locale': 'en_IE',
            'value': 'Contacts'
          },
          {
            'locale': 'en_IL',
            'value': 'Contacts'
          },
          {
            'locale': 'en_IN',
            'value': 'Contacts'
          },
          {
            'locale': 'en_JM',
            'value': 'Contacts'
          },
          {
            'locale': 'en_MY',
            'value': 'Contacts'
          },
          {
            'locale': 'en_PH',
            'value': 'Contacts'
          },
          {
            'locale': 'en_SG',
            'value': 'Contacts'
          },
          {
            'locale': 'en_ZA',
            'value': 'Contacts'
          },
          {
            'locale': 'es_419',
            'value': 'Contactos'
          },
          {
            'locale': 'es_AR',
            'value': 'Contactos'
          },
          {
            'locale': 'es_CL',
            'value': 'Contactos'
          },
          {
            'locale': 'es_CO',
            'value': 'Contactos'
          },
          {
            'locale': 'es_GT',
            'value': 'Contactos'
          },
          {
            'locale': 'es_PE',
            'value': 'Contactos'
          },
          {
            'locale': 'et_EE',
            'value': 'Kontaktid'
          },
          {
            'locale': 'fi_FI',
            'value': 'Yhteystiedot'
          },
          {
            'locale': 'fil_PH',
            'value': 'Mga Kontak'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Contacts'
          },
          {
            'locale': 'gl_ES',
            'value': 'Contactos'
          },
          {
            'locale': 'it_CH',
            'value': 'Contatti'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'کنلن'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Hubungan'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Hubungan'
          },
          {
            'locale': 'nn_NO',
            'value': 'Kontakter'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Maikgokaganyo'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਸੰਪਰਕ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Contacte'
          },
          {
            'locale': 'ru_EE',
            'value': 'Контакты'
          },
          {
            'locale': 'ru_IL',
            'value': 'Контакты'
          },
          {
            'locale': 'ru_LT',
            'value': 'Контакты'
          },
          {
            'locale': 'ru_LV',
            'value': 'Контакты'
          },
          {
            'locale': 'si_LK',
            'value': 'සබඳතා'
          },
          {
            'locale': 'sv_FI',
            'value': 'Kontakter'
          },
          {
            'locale': 'ta_LK',
            'value': 'தொடர்புகள்'
          },
          {
            'locale': 'ta_MY',
            'value': 'தொடர்புகள்'
          },
          {
            'locale': 'ta_SG',
            'value': 'தொடர்புகள்'
          },
          {
            'locale': 'ur_IN',
            'value': 'رابطے'
          },
          {
            'locale': 'ur_PK',
            'value': 'روابط'
          },
          {
            'locale': 'vi_VN',
            'value': 'Danh bạ'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Iikhontakthi'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '联系人'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '联系人'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '联系人'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '聯絡人'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '聯絡人'
          },
          {
            'locale': 'ar_EG',
            'value': 'جهات الاتصال'
          },
          {
            'locale': 'es_PR',
            'value': 'Contactos'
          },
          {
            'locale': 'es_PA',
            'value': 'Contactos'
          },
          {
            'locale': 'hil_PH',
            'value': 'Mga Kontak'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Dagiti Kontak'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Ba o ikgolaganyang le bone'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵉⵏⴻⵔⵎⴰⵙⴻⵏ'
          }
        ],
        'name': 'c_contacts',
        'properties': [
          {
            'description': [],
            'label': [
              {
                'locale': 'en_US',
                'value': 'Contact'
              },
              {
                'locale': 'af_ZA',
                'value': 'Kontak'
              },
              {
                'locale': 'ar_SA',
                'value': 'جهة الاتصال'
              },
              {
                'locale': 'bg_BG',
                'value': 'Контакт'
              },
              {
                'locale': 'cs_CZ',
                'value': 'Kontakt'
              },
              {
                'locale': 'da_DK',
                'value': 'Kontakt'
              },
              {
                'locale': 'de_CH',
                'value': 'Kontakt'
              },
              {
                'locale': 'de_DE',
                'value': 'Kontakt'
              },
              {
                'locale': 'el_GR',
                'value': 'Επαφή'
              },
              {
                'locale': 'es_ES',
                'value': 'Contacto'
              },
              {
                'locale': 'es_MX',
                'value': 'Contacto'
              },
              {
                'locale': 'es_US',
                'value': 'Contacto'
              },
              {
                'locale': 'fr_BE',
                'value': 'Contact'
              },
              {
                'locale': 'fr_CA',
                'value': 'Contact'
              },
              {
                'locale': 'fr_CH',
                'value': 'Contact'
              },
              {
                'locale': 'fr_FR',
                'value': 'Contact'
              },
              {
                'locale': 'he_IL',
                'value': 'איש קשר'
              },
              {
                'locale': 'hu_HU',
                'value': 'Kapcsolattartó'
              },
              {
                'locale': 'it_IT',
                'value': 'Contatto'
              },
              {
                'locale': 'ja_JP',
                'value': '連絡先'
              },
              {
                'locale': 'ka_GE',
                'value': 'კონტაქტი'
              },
              {
                'locale': 'ko_KR',
                'value': '연락처'
              },
              {
                'locale': 'lt_LT',
                'value': 'Kontaktinis asmuo'
              },
              {
                'locale': 'lv_LV',
                'value': 'Kontaktpersona'
              },
              {
                'locale': 'ms_MY',
                'value': 'Kenalan'
              },
              {
                'locale': 'nl_BE',
                'value': 'Contact'
              },
              {
                'locale': 'nl_NL',
                'value': 'Contactpersoon'
              },
              {
                'locale': 'pl_PL',
                'value': 'Kontakt'
              },
              {
                'locale': 'pt_BR',
                'value': 'Contato'
              },
              {
                'locale': 'pt_PT',
                'value': 'Contacto'
              },
              {
                'locale': 'ro_RO',
                'value': 'Contact'
              },
              {
                'locale': 'ru_RU',
                'value': 'Контактное лицо'
              },
              {
                'locale': 'ru_UA',
                'value': 'Контактное лицо'
              },
              {
                'locale': 'sk_SK',
                'value': 'Kontakt'
              },
              {
                'locale': 'sr_Latn_RS',
                'value': 'Kontakt'
              },
              {
                'locale': 'st_ZA',
                'value': 'Boikopanyo'
              },
              {
                'locale': 'sv_SE',
                'value': 'Kontakt'
              },
              {
                'locale': 'tr_TR',
                'value': 'İrtibat Kişisi'
              },
              {
                'locale': 'uk_UA',
                'value': 'Контактна інформація'
              },
              {
                'locale': 'zh_CN',
                'value': '联系人'
              },
              {
                'locale': 'zh_TW',
                'value': '聯繫人'
              },
              {
                'locale': 'zu_ZA',
                'value': 'Othintwayo'
              },
              {
                'locale': 'gu_IN',
                'value': 'સંપર્ક'
              },
              {
                'locale': 'hi_IN',
                'value': 'संपर्क करें'
              },
              {
                'locale': 'kn_IN',
                'value': 'ಸಂಪರ್ಕಿಸಿ'
              },
              {
                'locale': 'ml_IN',
                'value': 'ബന്ധപ്പെടുക'
              },
              {
                'locale': 'mr_IN',
                'value': 'संपर्क'
              },
              {
                'locale': 'or_IN',
                'value': 'ସମ୍ପର୍କ'
              },
              {
                'locale': 'pa_IN',
                'value': 'ਸੰਪਰਕ'
              },
              {
                'locale': 'ta_IN',
                'value': 'தொடர்பு'
              },
              {
                'locale': 'te_IN',
                'value': 'సంప్రదించండి'
              },
              {
                'locale': 'th_TH',
                'value': 'ผู้ติดต่อ'
              },
              {
                'locale': 'bn_IN',
                'value': 'যোগাযোগ'
              },
              {
                'locale': 'ceb_PH',
                'value': 'Kontak'
              },
              {
                'locale': 'de_AT',
                'value': 'Kontakt'
              },
              {
                'locale': 'en_AU',
                'value': 'Contact'
              },
              {
                'locale': 'en_CA',
                'value': 'Contact'
              },
              {
                'locale': 'en_GB',
                'value': 'Contact'
              },
              {
                'locale': 'en_NZ',
                'value': 'Contact'
              },
              {
                'locale': 'hr_HR',
                'value': 'Kontakt'
              },
              {
                'locale': 'sl_SI',
                'value': 'Stik'
              },
              {
                'locale': 'sr_Cyrl_RS',
                'value': 'Контакт'
              },
              {
                'locale': 'sr_Latn',
                'value': 'Kontakt'
              },
              {
                'locale': 'tl_PH',
                'value': 'Kontak'
              },
              {
                'locale': 'ar_DZ',
                'value': 'جهة اتصال'
              },
              {
                'locale': 'ar_IL',
                'value': 'جهة اتصال'
              },
              {
                'locale': 'ar_LB',
                'value': 'جهة اتصال'
              },
              {
                'locale': 'as_IN',
                'value': 'যোগাযোগ'
              },
              {
                'locale': 'ca_ES',
                'value': 'Contacte'
              },
              {
                'locale': 'de_BE',
                'value': 'Kontakt'
              },
              {
                'locale': 'en_BE',
                'value': 'Contact'
              },
              {
                'locale': 'en_HK',
                'value': 'Contact'
              },
              {
                'locale': 'en_IE',
                'value': 'Contact'
              },
              {
                'locale': 'en_IL',
                'value': 'Contact'
              },
              {
                'locale': 'en_IN',
                'value': 'Contact'
              },
              {
                'locale': 'en_JM',
                'value': 'Contact'
              },
              {
                'locale': 'en_MY',
                'value': 'Contact'
              },
              {
                'locale': 'en_PH',
                'value': 'Contact'
              },
              {
                'locale': 'en_SG',
                'value': 'Contact'
              },
              {
                'locale': 'en_ZA',
                'value': 'Contact'
              },
              {
                'locale': 'es_419',
                'value': 'Contacto'
              },
              {
                'locale': 'es_AR',
                'value': 'Contacto'
              },
              {
                'locale': 'es_CL',
                'value': 'Contacto'
              },
              {
                'locale': 'es_CO',
                'value': 'Contacto'
              },
              {
                'locale': 'es_GT',
                'value': 'Contacto'
              },
              {
                'locale': 'es_PE',
                'value': 'Contacto'
              },
              {
                'locale': 'et_EE',
                'value': 'Kontakt'
              },
              {
                'locale': 'fi_FI',
                'value': 'Yhteys'
              },
              {
                'locale': 'fil_PH',
                'value': 'Kontak'
              },
              {
                'locale': 'fr_DZ',
                'value': 'Contact'
              },
              {
                'locale': 'gl_ES',
                'value': 'Contacto'
              },
              {
                'locale': 'it_CH',
                'value': 'Contatto'
              },
              {
                'locale': 'ms_Arab_MY',
                'value': 'کنلن'
              },
              {
                'locale': 'ms_Latn_MY',
                'value': 'Hubungan'
              },
              {
                'locale': 'ms_Latn_SG',
                'value': 'Hubungan'
              },
              {
                'locale': 'nn_NO',
                'value': 'Kontakt'
              },
              {
                'locale': 'nso_ZA',
                'value': 'Boikgokaganyo'
              },
              {
                'locale': 'pa_Guru_IN',
                'value': 'ਸੰਪਰਕ'
              },
              {
                'locale': 'ro_MD',
                'value': 'Contact'
              },
              {
                'locale': 'ru_EE',
                'value': 'Контактное лицо'
              },
              {
                'locale': 'ru_IL',
                'value': 'Контактное лицо'
              },
              {
                'locale': 'ru_LT',
                'value': 'Контактное лицо'
              },
              {
                'locale': 'ru_LV',
                'value': 'Контактное лицо'
              },
              {
                'locale': 'si_LK',
                'value': 'සබඳතාවය'
              },
              {
                'locale': 'sv_FI',
                'value': 'Kontakt'
              },
              {
                'locale': 'ta_LK',
                'value': 'தொடர்பு'
              },
              {
                'locale': 'ta_MY',
                'value': 'தொடர்பு'
              },
              {
                'locale': 'ta_SG',
                'value': 'தொடர்பு'
              },
              {
                'locale': 'ur_IN',
                'value': 'رابطہ'
              },
              {
                'locale': 'ur_PK',
                'value': 'رابطہ کریں'
              },
              {
                'locale': 'vi_VN',
                'value': 'Liên hệ'
              },
              {
                'locale': 'xh_ZA',
                'value': 'Ikhontakthi'
              },
              {
                'locale': 'zh_Hans_CN',
                'value': '联系人'
              },
              {
                'locale': 'zh_Hans_MY',
                'value': '联系'
              },
              {
                'locale': 'zh_Hans_SG',
                'value': '联系'
              },
              {
                'locale': 'zh_Hant_HK',
                'value': '聯絡人'
              },
              {
                'locale': 'zh_Hant_TW',
                'value': '聯絡人'
              },
              {
                'locale': 'ar_EG',
                'value': 'جهة الاتصال'
              },
              {
                'locale': 'es_PR',
                'value': 'Contacto'
              },
              {
                'locale': 'es_PA',
                'value': 'Contacto'
              },
              {
                'locale': 'hil_PH',
                'value': 'Kontak'
              },
              {
                'locale': 'ilo_PH',
                'value': 'Kontak'
              },
              {
                'locale': 'tn_ZA',
                'value': 'Yo o Ikgolaganyang le Ene'
              },
              {
                'locale': 'zgh_DZ',
                'value': 'ⴰⵏⴻⵔⵎⴻⵙ'
              }
            ],
            'name': 'c_contact'
          },
          {
            'description': [],
            'label': [
              {
                'locale': 'en_US',
                'value': 'Key'
              },
              {
                'locale': 'af_ZA',
                'value': 'Sleutel'
              },
              {
                'locale': 'ar_SA',
                'value': 'المفتاح'
              },
              {
                'locale': 'bg_BG',
                'value': 'Ключ'
              },
              {
                'locale': 'cs_CZ',
                'value': 'Klíč'
              },
              {
                'locale': 'da_DK',
                'value': 'Nøgle'
              },
              {
                'locale': 'de_CH',
                'value': 'Schlüssel'
              },
              {
                'locale': 'de_DE',
                'value': 'Schlüssel'
              },
              {
                'locale': 'el_GR',
                'value': 'Κλειδί'
              },
              {
                'locale': 'es_ES',
                'value': 'Clave'
              },
              {
                'locale': 'es_MX',
                'value': 'Clave'
              },
              {
                'locale': 'es_US',
                'value': 'Clave'
              },
              {
                'locale': 'fr_BE',
                'value': 'Clé'
              },
              {
                'locale': 'fr_CA',
                'value': 'Clé'
              },
              {
                'locale': 'fr_CH',
                'value': 'Clé'
              },
              {
                'locale': 'fr_FR',
                'value': 'Clé'
              },
              {
                'locale': 'he_IL',
                'value': 'מפתח'
              },
              {
                'locale': 'hu_HU',
                'value': 'Kulcs'
              },
              {
                'locale': 'it_IT',
                'value': 'Chiave'
              },
              {
                'locale': 'ja_JP',
                'value': 'キー'
              },
              {
                'locale': 'ka_GE',
                'value': 'გასაღები'
              },
              {
                'locale': 'ko_KR',
                'value': '키'
              },
              {
                'locale': 'lt_LT',
                'value': 'Raktas'
              },
              {
                'locale': 'lv_LV',
                'value': 'Atslēga'
              },
              {
                'locale': 'ms_MY',
                'value': 'Kekunci'
              },
              {
                'locale': 'nl_BE',
                'value': 'Toets'
              },
              {
                'locale': 'nl_NL',
                'value': 'Sleutel'
              },
              {
                'locale': 'pl_PL',
                'value': 'Klucz'
              },
              {
                'locale': 'pt_BR',
                'value': 'Chave'
              },
              {
                'locale': 'pt_PT',
                'value': 'Chave'
              },
              {
                'locale': 'ro_RO',
                'value': 'Cheie'
              },
              {
                'locale': 'ru_RU',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_UA',
                'value': 'Ключ'
              },
              {
                'locale': 'sk_SK',
                'value': 'Kľúč'
              },
              {
                'locale': 'sr_Latn_RS',
                'value': 'Ključ'
              },
              {
                'locale': 'st_ZA',
                'value': 'Senotlolo'
              },
              {
                'locale': 'sv_SE',
                'value': 'Nyckel'
              },
              {
                'locale': 'tr_TR',
                'value': 'Anahtar'
              },
              {
                'locale': 'uk_UA',
                'value': 'Ключ'
              },
              {
                'locale': 'zh_CN',
                'value': '密钥'
              },
              {
                'locale': 'zh_TW',
                'value': '密鑰'
              },
              {
                'locale': 'zu_ZA',
                'value': 'Ukhiye'
              },
              {
                'locale': 'gu_IN',
                'value': 'કી'
              },
              {
                'locale': 'hi_IN',
                'value': 'कुंजी'
              },
              {
                'locale': 'kn_IN',
                'value': 'ಕೀಲಿ'
              },
              {
                'locale': 'ml_IN',
                'value': 'കീ'
              },
              {
                'locale': 'mr_IN',
                'value': 'की'
              },
              {
                'locale': 'or_IN',
                'value': 'କୀ'
              },
              {
                'locale': 'pa_IN',
                'value': 'ਕੁੰਜੀ'
              },
              {
                'locale': 'ta_IN',
                'value': 'முக்கிய தொகுப்பு'
              },
              {
                'locale': 'te_IN',
                'value': 'కీ'
              },
              {
                'locale': 'th_TH',
                'value': 'แก่นสำคัญ'
              },
              {
                'locale': 'bn_IN',
                'value': 'কী'
              },
              {
                'locale': 'ceb_PH',
                'value': 'Key'
              },
              {
                'locale': 'de_AT',
                'value': 'Schlüssel'
              },
              {
                'locale': 'en_AU',
                'value': 'Key'
              },
              {
                'locale': 'en_CA',
                'value': 'Key'
              },
              {
                'locale': 'en_GB',
                'value': 'Key'
              },
              {
                'locale': 'en_NZ',
                'value': 'Key'
              },
              {
                'locale': 'hr_HR',
                'value': 'Ključ'
              },
              {
                'locale': 'sl_SI',
                'value': 'Ključ'
              },
              {
                'locale': 'sr_Cyrl_RS',
                'value': 'Кључ'
              },
              {
                'locale': 'sr_Latn',
                'value': 'Ključ'
              },
              {
                'locale': 'tl_PH',
                'value': 'Key'
              },
              {
                'locale': 'ar_DZ',
                'value': 'مفتاح'
              },
              {
                'locale': 'ar_IL',
                'value': 'مفتاح'
              },
              {
                'locale': 'ar_LB',
                'value': 'مفتاح'
              },
              {
                'locale': 'as_IN',
                'value': 'কী'
              },
              {
                'locale': 'ca_ES',
                'value': 'Clau'
              },
              {
                'locale': 'de_BE',
                'value': 'Schlüssel'
              },
              {
                'locale': 'en_BE',
                'value': 'Key'
              },
              {
                'locale': 'en_HK',
                'value': 'Key'
              },
              {
                'locale': 'en_IE',
                'value': 'Key'
              },
              {
                'locale': 'en_IL',
                'value': 'Key'
              },
              {
                'locale': 'en_IN',
                'value': 'Key'
              },
              {
                'locale': 'en_JM',
                'value': 'Key'
              },
              {
                'locale': 'en_MY',
                'value': 'Key'
              },
              {
                'locale': 'en_PH',
                'value': 'Key'
              },
              {
                'locale': 'en_SG',
                'value': 'Key'
              },
              {
                'locale': 'en_ZA',
                'value': 'Key'
              },
              {
                'locale': 'es_419',
                'value': 'Clave'
              },
              {
                'locale': 'es_AR',
                'value': 'Clave'
              },
              {
                'locale': 'es_CL',
                'value': 'Clave'
              },
              {
                'locale': 'es_CO',
                'value': 'Clave'
              },
              {
                'locale': 'es_GT',
                'value': 'Clave'
              },
              {
                'locale': 'es_PE',
                'value': 'Clave'
              },
              {
                'locale': 'et_EE',
                'value': 'Võti'
              },
              {
                'locale': 'fi_FI',
                'value': 'Avain'
              },
              {
                'locale': 'fil_PH',
                'value': 'Key'
              },
              {
                'locale': 'fr_DZ',
                'value': 'Clé'
              },
              {
                'locale': 'gl_ES',
                'value': 'Clave'
              },
              {
                'locale': 'it_CH',
                'value': 'Chiave'
              },
              {
                'locale': 'ms_Arab_MY',
                'value': 'كونچي'
              },
              {
                'locale': 'ms_Latn_MY',
                'value': 'Kunci'
              },
              {
                'locale': 'ms_Latn_SG',
                'value': 'Kunci'
              },
              {
                'locale': 'nn_NO',
                'value': 'Nøkkel'
              },
              {
                'locale': 'nso_ZA',
                'value': 'Konopi'
              },
              {
                'locale': 'pa_Guru_IN',
                'value': 'ਕੁੰਜੀ'
              },
              {
                'locale': 'ro_MD',
                'value': 'Cheie'
              },
              {
                'locale': 'ru_EE',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_IL',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_LT',
                'value': 'Ключ'
              },
              {
                'locale': 'ru_LV',
                'value': 'Ключ'
              },
              {
                'locale': 'si_LK',
                'value': 'යතුර'
              },
              {
                'locale': 'sv_FI',
                'value': 'Nyckel'
              },
              {
                'locale': 'ta_LK',
                'value': 'முக்கிய'
              },
              {
                'locale': 'ta_MY',
                'value': 'சாவி'
              },
              {
                'locale': 'ta_SG',
                'value': 'சாவி'
              },
              {
                'locale': 'ur_IN',
                'value': 'کلید'
              },
              {
                'locale': 'ur_PK',
                'value': 'کلید'
              },
              {
                'locale': 'vi_VN',
                'value': 'Chìa khóa'
              },
              {
                'locale': 'xh_ZA',
                'value': 'Isitshixo'
              },
              {
                'locale': 'zh_Hans_CN',
                'value': '关键'
              },
              {
                'locale': 'zh_Hans_MY',
                'value': '密钥'
              },
              {
                'locale': 'zh_Hans_SG',
                'value': '密钥'
              },
              {
                'locale': 'zh_Hant_HK',
                'value': '鑰匙'
              },
              {
                'locale': 'zh_Hant_TW',
                'value': '密鑰'
              },
              {
                'locale': 'ar_EG',
                'value': 'المفتاح'
              },
              {
                'locale': 'es_PR',
                'value': 'Clave'
              },
              {
                'locale': 'es_PA',
                'value': 'Clave'
              },
              {
                'locale': 'hil_PH',
                'value': 'Key'
              },
              {
                'locale': 'ilo_PH',
                'value': 'Key'
              },
              {
                'locale': 'tn_ZA',
                'value': 'Selotlolo'
              },
              {
                'locale': 'zgh_DZ',
                'value': 'ⵜⴰⵙⴰⵔⵓⵜ'
              }
            ],
            'name': 'c_key'
          },
          {
            'description': [],
            'label': [
              {
                'locale': 'en_US',
                'value': 'Type'
              },
              {
                'locale': 'af_ZA',
                'value': 'Tipe'
              },
              {
                'locale': 'ar_SA',
                'value': 'النوع'
              },
              {
                'locale': 'bg_BG',
                'value': 'Вид'
              },
              {
                'locale': 'cs_CZ',
                'value': 'Typ'
              },
              {
                'locale': 'da_DK',
                'value': 'Type'
              },
              {
                'locale': 'de_CH',
                'value': 'Typ'
              },
              {
                'locale': 'de_DE',
                'value': 'Typ'
              },
              {
                'locale': 'el_GR',
                'value': 'Τύπος'
              },
              {
                'locale': 'es_ES',
                'value': 'Tipo'
              },
              {
                'locale': 'es_MX',
                'value': 'Tipo'
              },
              {
                'locale': 'es_US',
                'value': 'Tipo'
              },
              {
                'locale': 'fr_BE',
                'value': 'Type'
              },
              {
                'locale': 'fr_CA',
                'value': 'Type'
              },
              {
                'locale': 'fr_CH',
                'value': 'Type'
              },
              {
                'locale': 'fr_FR',
                'value': 'Type'
              },
              {
                'locale': 'he_IL',
                'value': 'סוג'
              },
              {
                'locale': 'hu_HU',
                'value': 'Típus'
              },
              {
                'locale': 'it_IT',
                'value': 'Tipo'
              },
              {
                'locale': 'ja_JP',
                'value': 'タイプ'
              },
              {
                'locale': 'ka_GE',
                'value': 'ტიპი'
              },
              {
                'locale': 'ko_KR',
                'value': '유형'
              },
              {
                'locale': 'lt_LT',
                'value': 'Tipas'
              },
              {
                'locale': 'lv_LV',
                'value': 'Veids'
              },
              {
                'locale': 'ms_MY',
                'value': 'Jenis'
              },
              {
                'locale': 'nl_BE',
                'value': 'Type'
              },
              {
                'locale': 'nl_NL',
                'value': 'Soort'
              },
              {
                'locale': 'pl_PL',
                'value': 'Typ'
              },
              {
                'locale': 'pt_BR',
                'value': 'Tipo'
              },
              {
                'locale': 'pt_PT',
                'value': 'Tipo'
              },
              {
                'locale': 'ro_RO',
                'value': 'Tip'
              },
              {
                'locale': 'ru_RU',
                'value': 'Тип'
              },
              {
                'locale': 'ru_UA',
                'value': 'Тип'
              },
              {
                'locale': 'sk_SK',
                'value': 'Typ'
              },
              {
                'locale': 'sr_Latn_RS',
                'value': 'Tip'
              },
              {
                'locale': 'st_ZA',
                'value': 'Mofuta'
              },
              {
                'locale': 'sv_SE',
                'value': 'Typ'
              },
              {
                'locale': 'tr_TR',
                'value': 'Tür'
              },
              {
                'locale': 'uk_UA',
                'value': 'Тип'
              },
              {
                'locale': 'zh_CN',
                'value': '类型'
              },
              {
                'locale': 'zh_TW',
                'value': '類型'
              },
              {
                'locale': 'zu_ZA',
                'value': 'Uhlobo'
              },
              {
                'locale': 'gu_IN',
                'value': 'પ્રકાર'
              },
              {
                'locale': 'hi_IN',
                'value': 'प्रकार'
              },
              {
                'locale': 'kn_IN',
                'value': 'ವಿಧ'
              },
              {
                'locale': 'ml_IN',
                'value': 'ടൈപ്പ് ചെയ്യുക'
              },
              {
                'locale': 'mr_IN',
                'value': 'प्रकार'
              },
              {
                'locale': 'or_IN',
                'value': 'ପ୍ରକାର'
              },
              {
                'locale': 'pa_IN',
                'value': 'ਪ੍ਰਕਾਰ'
              },
              {
                'locale': 'ta_IN',
                'value': 'வகை'
              },
              {
                'locale': 'te_IN',
                'value': 'రకం'
              },
              {
                'locale': 'th_TH',
                'value': 'ประเภท'
              },
              {
                'locale': 'bn_IN',
                'value': 'কাজ সমাপন'
              },
              {
                'locale': 'ceb_PH',
                'value': 'Matangok'
              },
              {
                'locale': 'de_AT',
                'value': 'Typ'
              },
              {
                'locale': 'en_AU',
                'value': 'Type'
              },
              {
                'locale': 'en_CA',
                'value': 'Type'
              },
              {
                'locale': 'en_GB',
                'value': 'Type'
              },
              {
                'locale': 'en_NZ',
                'value': 'Type'
              },
              {
                'locale': 'hr_HR',
                'value': 'Vrsta'
              },
              {
                'locale': 'sl_SI',
                'value': 'Tip'
              },
              {
                'locale': 'sr_Cyrl_RS',
                'value': 'Тип'
              },
              {
                'locale': 'sr_Latn',
                'value': 'Tip'
              },
              {
                'locale': 'tl_PH',
                'value': 'Uri'
              },
              {
                'locale': 'ar_DZ',
                'value': 'النوع'
              },
              {
                'locale': 'ar_IL',
                'value': 'النوع'
              },
              {
                'locale': 'ar_LB',
                'value': 'النوع'
              },
              {
                'locale': 'as_IN',
                'value': 'প্ৰকাৰ'
              },
              {
                'locale': 'ca_ES',
                'value': 'Tipus'
              },
              {
                'locale': 'de_BE',
                'value': 'Typ'
              },
              {
                'locale': 'en_BE',
                'value': 'Type'
              },
              {
                'locale': 'en_HK',
                'value': 'Type'
              },
              {
                'locale': 'en_IE',
                'value': 'Type'
              },
              {
                'locale': 'en_IL',
                'value': 'Type'
              },
              {
                'locale': 'en_IN',
                'value': 'Type'
              },
              {
                'locale': 'en_JM',
                'value': 'Type'
              },
              {
                'locale': 'en_MY',
                'value': 'Type'
              },
              {
                'locale': 'en_PH',
                'value': 'Type'
              },
              {
                'locale': 'en_SG',
                'value': 'Type'
              },
              {
                'locale': 'en_ZA',
                'value': 'Type'
              },
              {
                'locale': 'es_419',
                'value': 'Tipo'
              },
              {
                'locale': 'es_AR',
                'value': 'Tipo'
              },
              {
                'locale': 'es_CL',
                'value': 'Tipo'
              },
              {
                'locale': 'es_CO',
                'value': 'Tipo'
              },
              {
                'locale': 'es_GT',
                'value': 'Tipo'
              },
              {
                'locale': 'es_PE',
                'value': 'Tipo'
              },
              {
                'locale': 'et_EE',
                'value': 'Tüüp'
              },
              {
                'locale': 'fi_FI',
                'value': 'Tyyppi'
              },
              {
                'locale': 'fil_PH',
                'value': 'Uri'
              },
              {
                'locale': 'fr_DZ',
                'value': 'Type'
              },
              {
                'locale': 'gl_ES',
                'value': 'Tipo'
              },
              {
                'locale': 'it_CH',
                'value': 'Tipo'
              },
              {
                'locale': 'ms_Arab_MY',
                'value': 'جنيس'
              },
              {
                'locale': 'ms_Latn_MY',
                'value': 'Jenis'
              },
              {
                'locale': 'ms_Latn_SG',
                'value': 'Jenis'
              },
              {
                'locale': 'nn_NO',
                'value': 'Type'
              },
              {
                'locale': 'nso_ZA',
                'value': 'Mohuta'
              },
              {
                'locale': 'pa_Guru_IN',
                'value': 'ਕਿਸਮ'
              },
              {
                'locale': 'ro_MD',
                'value': 'Tip'
              },
              {
                'locale': 'ru_EE',
                'value': 'Тип'
              },
              {
                'locale': 'ru_IL',
                'value': 'Тип'
              },
              {
                'locale': 'ru_LT',
                'value': 'Тип'
              },
              {
                'locale': 'ru_LV',
                'value': 'Тип'
              },
              {
                'locale': 'si_LK',
                'value': 'වර්ගය'
              },
              {
                'locale': 'sv_FI',
                'value': 'Typ'
              },
              {
                'locale': 'ta_LK',
                'value': 'வகை'
              },
              {
                'locale': 'ta_MY',
                'value': 'வகை'
              },
              {
                'locale': 'ta_SG',
                'value': 'வகை'
              },
              {
                'locale': 'ur_IN',
                'value': 'قسم'
              },
              {
                'locale': 'ur_PK',
                'value': 'قسم'
              },
              {
                'locale': 'vi_VN',
                'value': 'Kiểu'
              },
              {
                'locale': 'xh_ZA',
                'value': 'Uhlobo'
              },
              {
                'locale': 'zh_Hans_CN',
                'value': '类型'
              },
              {
                'locale': 'zh_Hans_MY',
                'value': '类型'
              },
              {
                'locale': 'zh_Hans_SG',
                'value': '类型'
              },
              {
                'locale': 'zh_Hant_HK',
                'value': '類型'
              },
              {
                'locale': 'zh_Hant_TW',
                'value': '類型'
              },
              {
                'locale': 'ar_EG',
                'value': 'النوع'
              },
              {
                'locale': 'es_PR',
                'value': 'Tipo'
              },
              {
                'locale': 'es_PA',
                'value': 'Tipo'
              },
              {
                'locale': 'hil_PH',
                'value': 'Klase'
              },
              {
                'locale': 'ilo_PH',
                'value': 'Kita'
              },
              {
                'locale': 'tn_ZA',
                'value': 'Mofuta'
              },
              {
                'locale': 'zgh_DZ',
                'value': 'ⴰⵏⴰⵡ'
              }
            ],
            'name': 'c_type'
          }
        ]
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Country'
          },
          {
            'locale': 'af_ZA',
            'value': 'Land'
          },
          {
            'locale': 'ar_SA',
            'value': 'البلد'
          },
          {
            'locale': 'bg_BG',
            'value': 'Държава'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Země'
          },
          {
            'locale': 'da_DK',
            'value': 'Land'
          },
          {
            'locale': 'de_CH',
            'value': 'Land'
          },
          {
            'locale': 'de_DE',
            'value': 'Land'
          },
          {
            'locale': 'el_GR',
            'value': 'Χώρα'
          },
          {
            'locale': 'es_ES',
            'value': 'País'
          },
          {
            'locale': 'es_MX',
            'value': 'País'
          },
          {
            'locale': 'es_US',
            'value': 'País'
          },
          {
            'locale': 'fr_BE',
            'value': 'Pays'
          },
          {
            'locale': 'fr_CA',
            'value': 'Pays'
          },
          {
            'locale': 'fr_CH',
            'value': 'Pays'
          },
          {
            'locale': 'fr_FR',
            'value': 'Pays'
          },
          {
            'locale': 'he_IL',
            'value': 'מדינה'
          },
          {
            'locale': 'hu_HU',
            'value': 'Ország'
          },
          {
            'locale': 'it_IT',
            'value': 'Paese'
          },
          {
            'locale': 'ja_JP',
            'value': 'Country（国）'
          },
          {
            'locale': 'ka_GE',
            'value': 'ქვეყანა'
          },
          {
            'locale': 'ko_KR',
            'value': '국가'
          },
          {
            'locale': 'lt_LT',
            'value': 'Šalis'
          },
          {
            'locale': 'lv_LV',
            'value': 'Valsts'
          },
          {
            'locale': 'ms_MY',
            'value': 'Negara'
          },
          {
            'locale': 'nl_BE',
            'value': 'Land'
          },
          {
            'locale': 'nl_NL',
            'value': 'Land'
          },
          {
            'locale': 'pl_PL',
            'value': 'Kraj'
          },
          {
            'locale': 'pt_BR',
            'value': 'País'
          },
          {
            'locale': 'pt_PT',
            'value': 'País'
          },
          {
            'locale': 'ro_RO',
            'value': 'Țară'
          },
          {
            'locale': 'ru_RU',
            'value': 'Страна'
          },
          {
            'locale': 'ru_UA',
            'value': 'Страна'
          },
          {
            'locale': 'sk_SK',
            'value': 'Krajina'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Zemlja'
          },
          {
            'locale': 'st_ZA',
            'value': 'Naha'
          },
          {
            'locale': 'sv_SE',
            'value': 'Land'
          },
          {
            'locale': 'tr_TR',
            'value': 'Ülke'
          },
          {
            'locale': 'uk_UA',
            'value': 'Країна'
          },
          {
            'locale': 'zh_CN',
            'value': '国家或地区'
          },
          {
            'locale': 'zh_TW',
            'value': '國家'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Izwe'
          },
          {
            'locale': 'gu_IN',
            'value': 'દેશ'
          },
          {
            'locale': 'hi_IN',
            'value': 'देश'
          },
          {
            'locale': 'kn_IN',
            'value': 'ದೇಶ'
          },
          {
            'locale': 'ml_IN',
            'value': 'രാജ്യം'
          },
          {
            'locale': 'mr_IN',
            'value': 'देश'
          },
          {
            'locale': 'or_IN',
            'value': 'ଦେଶ'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਦੇਸ਼'
          },
          {
            'locale': 'ta_IN',
            'value': 'நாடு'
          },
          {
            'locale': 'te_IN',
            'value': 'దేశం'
          },
          {
            'locale': 'th_TH',
            'value': 'ประเทศ'
          },
          {
            'locale': 'bn_IN',
            'value': 'দেশ'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Nasud'
          },
          {
            'locale': 'de_AT',
            'value': 'Land'
          },
          {
            'locale': 'en_AU',
            'value': 'Country'
          },
          {
            'locale': 'en_CA',
            'value': 'Country'
          },
          {
            'locale': 'en_GB',
            'value': 'Country'
          },
          {
            'locale': 'en_NZ',
            'value': 'Country'
          },
          {
            'locale': 'hr_HR',
            'value': 'Zemlja'
          },
          {
            'locale': 'sl_SI',
            'value': 'Država'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Земља'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Država'
          },
          {
            'locale': 'tl_PH',
            'value': 'Bansa'
          },
          {
            'locale': 'ar_DZ',
            'value': 'الدولة'
          },
          {
            'locale': 'ar_IL',
            'value': 'الدولة'
          },
          {
            'locale': 'ar_LB',
            'value': 'الدولة'
          },
          {
            'locale': 'as_IN',
            'value': 'দেশ'
          },
          {
            'locale': 'ca_ES',
            'value': 'País'
          },
          {
            'locale': 'de_BE',
            'value': 'Land'
          },
          {
            'locale': 'en_BE',
            'value': 'Country'
          },
          {
            'locale': 'en_HK',
            'value': 'Country'
          },
          {
            'locale': 'en_IE',
            'value': 'Country'
          },
          {
            'locale': 'en_IL',
            'value': 'Country'
          },
          {
            'locale': 'en_IN',
            'value': 'Country'
          },
          {
            'locale': 'en_JM',
            'value': 'Country'
          },
          {
            'locale': 'en_MY',
            'value': 'Country'
          },
          {
            'locale': 'en_PH',
            'value': 'Country'
          },
          {
            'locale': 'en_SG',
            'value': 'Country'
          },
          {
            'locale': 'en_ZA',
            'value': 'Country'
          },
          {
            'locale': 'es_419',
            'value': 'País'
          },
          {
            'locale': 'es_AR',
            'value': 'País'
          },
          {
            'locale': 'es_CL',
            'value': 'País'
          },
          {
            'locale': 'es_CO',
            'value': 'País'
          },
          {
            'locale': 'es_GT',
            'value': 'País'
          },
          {
            'locale': 'es_PE',
            'value': 'País'
          },
          {
            'locale': 'et_EE',
            'value': 'Riik'
          },
          {
            'locale': 'fi_FI',
            'value': 'Maa'
          },
          {
            'locale': 'fil_PH',
            'value': 'Bansa'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Pays'
          },
          {
            'locale': 'gl_ES',
            'value': 'País'
          },
          {
            'locale': 'it_CH',
            'value': 'Paese'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'نݢارا'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Negara'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Negara'
          },
          {
            'locale': 'nn_NO',
            'value': 'Land'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Naga'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਦੇਸ਼'
          },
          {
            'locale': 'ro_MD',
            'value': 'Țară'
          },
          {
            'locale': 'ru_EE',
            'value': 'Страна'
          },
          {
            'locale': 'ru_IL',
            'value': 'Страна'
          },
          {
            'locale': 'ru_LT',
            'value': 'Страна'
          },
          {
            'locale': 'ru_LV',
            'value': 'Страна'
          },
          {
            'locale': 'si_LK',
            'value': 'රට'
          },
          {
            'locale': 'sv_FI',
            'value': 'Land'
          },
          {
            'locale': 'ta_LK',
            'value': 'நாடு'
          },
          {
            'locale': 'ta_MY',
            'value': 'நாடு'
          },
          {
            'locale': 'ta_SG',
            'value': 'நாடு'
          },
          {
            'locale': 'ur_IN',
            'value': 'ملک'
          },
          {
            'locale': 'ur_PK',
            'value': 'ملک'
          },
          {
            'locale': 'vi_VN',
            'value': 'Quốc gia'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Ilizwe'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '国家'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '国家'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '国家/地区'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '國家'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '國家'
          },
          {
            'locale': 'ar_EG',
            'value': 'البلد'
          },
          {
            'locale': 'es_PR',
            'value': 'País'
          },
          {
            'locale': 'es_PA',
            'value': 'País'
          },
          {
            'locale': 'hil_PH',
            'value': 'Pungsod'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Pagilian'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Naga'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵜⴰⵎⵓⵔⵜ'
          }
        ],
        'name': 'c_country',
        'properties': []
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Key'
          },
          {
            'locale': 'af_ZA',
            'value': 'Sleutel'
          },
          {
            'locale': 'ar_SA',
            'value': 'المفتاح'
          },
          {
            'locale': 'bg_BG',
            'value': 'Ключ'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Klíč'
          },
          {
            'locale': 'da_DK',
            'value': 'Nøgle'
          },
          {
            'locale': 'de_CH',
            'value': 'Schlüssel'
          },
          {
            'locale': 'de_DE',
            'value': 'Schlüssel'
          },
          {
            'locale': 'el_GR',
            'value': 'Κλειδί'
          },
          {
            'locale': 'es_ES',
            'value': 'Clave'
          },
          {
            'locale': 'es_MX',
            'value': 'Clave'
          },
          {
            'locale': 'es_US',
            'value': 'Clave'
          },
          {
            'locale': 'fr_BE',
            'value': 'Clé'
          },
          {
            'locale': 'fr_CA',
            'value': 'Clé'
          },
          {
            'locale': 'fr_CH',
            'value': 'Clé'
          },
          {
            'locale': 'fr_FR',
            'value': 'Clé'
          },
          {
            'locale': 'he_IL',
            'value': 'מפתח'
          },
          {
            'locale': 'hu_HU',
            'value': 'Kulcs'
          },
          {
            'locale': 'it_IT',
            'value': 'Chiave'
          },
          {
            'locale': 'ja_JP',
            'value': 'キー'
          },
          {
            'locale': 'ka_GE',
            'value': 'გასაღები'
          },
          {
            'locale': 'ko_KR',
            'value': '키'
          },
          {
            'locale': 'lt_LT',
            'value': 'Raktas'
          },
          {
            'locale': 'lv_LV',
            'value': 'Atslēga'
          },
          {
            'locale': 'ms_MY',
            'value': 'Kekunci'
          },
          {
            'locale': 'nl_BE',
            'value': 'Toets'
          },
          {
            'locale': 'nl_NL',
            'value': 'Sleutel'
          },
          {
            'locale': 'pl_PL',
            'value': 'Klucz'
          },
          {
            'locale': 'pt_BR',
            'value': 'Chave'
          },
          {
            'locale': 'pt_PT',
            'value': 'Chave'
          },
          {
            'locale': 'ro_RO',
            'value': 'Cheie'
          },
          {
            'locale': 'ru_RU',
            'value': 'Ключ'
          },
          {
            'locale': 'ru_UA',
            'value': 'Ключ'
          },
          {
            'locale': 'sk_SK',
            'value': 'Kľúč'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Ključ'
          },
          {
            'locale': 'st_ZA',
            'value': 'Senotlolo'
          },
          {
            'locale': 'sv_SE',
            'value': 'Nyckel'
          },
          {
            'locale': 'tr_TR',
            'value': 'Anahtar'
          },
          {
            'locale': 'uk_UA',
            'value': 'Ключ'
          },
          {
            'locale': 'zh_CN',
            'value': '密钥'
          },
          {
            'locale': 'zh_TW',
            'value': '密鑰'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Ukhiye'
          },
          {
            'locale': 'gu_IN',
            'value': 'કી'
          },
          {
            'locale': 'hi_IN',
            'value': 'कुंजी'
          },
          {
            'locale': 'kn_IN',
            'value': 'ಕೀಲಿ'
          },
          {
            'locale': 'ml_IN',
            'value': 'കീ'
          },
          {
            'locale': 'mr_IN',
            'value': 'की'
          },
          {
            'locale': 'or_IN',
            'value': 'କୀ'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਕੁੰਜੀ'
          },
          {
            'locale': 'ta_IN',
            'value': 'முக்கிய தொகுப்பு'
          },
          {
            'locale': 'te_IN',
            'value': 'కీ'
          },
          {
            'locale': 'th_TH',
            'value': 'แก่นสำคัญ'
          },
          {
            'locale': 'bn_IN',
            'value': 'কী'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Key'
          },
          {
            'locale': 'de_AT',
            'value': 'Schlüssel'
          },
          {
            'locale': 'en_AU',
            'value': 'Key'
          },
          {
            'locale': 'en_CA',
            'value': 'Key'
          },
          {
            'locale': 'en_GB',
            'value': 'Key'
          },
          {
            'locale': 'en_NZ',
            'value': 'Key'
          },
          {
            'locale': 'hr_HR',
            'value': 'Ključ'
          },
          {
            'locale': 'sl_SI',
            'value': 'Ključ'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Кључ'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Ključ'
          },
          {
            'locale': 'tl_PH',
            'value': 'Key'
          },
          {
            'locale': 'ar_DZ',
            'value': 'مفتاح'
          },
          {
            'locale': 'ar_IL',
            'value': 'مفتاح'
          },
          {
            'locale': 'ar_LB',
            'value': 'مفتاح'
          },
          {
            'locale': 'as_IN',
            'value': 'কী'
          },
          {
            'locale': 'ca_ES',
            'value': 'Clau'
          },
          {
            'locale': 'de_BE',
            'value': 'Schlüssel'
          },
          {
            'locale': 'en_BE',
            'value': 'Key'
          },
          {
            'locale': 'en_HK',
            'value': 'Key'
          },
          {
            'locale': 'en_IE',
            'value': 'Key'
          },
          {
            'locale': 'en_IL',
            'value': 'Key'
          },
          {
            'locale': 'en_IN',
            'value': 'Key'
          },
          {
            'locale': 'en_JM',
            'value': 'Key'
          },
          {
            'locale': 'en_MY',
            'value': 'Key'
          },
          {
            'locale': 'en_PH',
            'value': 'Key'
          },
          {
            'locale': 'en_SG',
            'value': 'Key'
          },
          {
            'locale': 'en_ZA',
            'value': 'Key'
          },
          {
            'locale': 'es_419',
            'value': 'Clave'
          },
          {
            'locale': 'es_AR',
            'value': 'Clave'
          },
          {
            'locale': 'es_CL',
            'value': 'Clave'
          },
          {
            'locale': 'es_CO',
            'value': 'Clave'
          },
          {
            'locale': 'es_GT',
            'value': 'Clave'
          },
          {
            'locale': 'es_PE',
            'value': 'Clave'
          },
          {
            'locale': 'et_EE',
            'value': 'Võti'
          },
          {
            'locale': 'fi_FI',
            'value': 'Avain'
          },
          {
            'locale': 'fil_PH',
            'value': 'Key'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Clé'
          },
          {
            'locale': 'gl_ES',
            'value': 'Clave'
          },
          {
            'locale': 'it_CH',
            'value': 'Chiave'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'كونچي'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Kunci'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Kunci'
          },
          {
            'locale': 'nn_NO',
            'value': 'Nøkkel'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Konopi'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਕੁੰਜੀ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Cheie'
          },
          {
            'locale': 'ru_EE',
            'value': 'Ключ'
          },
          {
            'locale': 'ru_IL',
            'value': 'Ключ'
          },
          {
            'locale': 'ru_LT',
            'value': 'Ключ'
          },
          {
            'locale': 'ru_LV',
            'value': 'Ключ'
          },
          {
            'locale': 'si_LK',
            'value': 'යතුර'
          },
          {
            'locale': 'sv_FI',
            'value': 'Nyckel'
          },
          {
            'locale': 'ta_LK',
            'value': 'முக்கிய'
          },
          {
            'locale': 'ta_MY',
            'value': 'சாவி'
          },
          {
            'locale': 'ta_SG',
            'value': 'சாவி'
          },
          {
            'locale': 'ur_IN',
            'value': 'کلید'
          },
          {
            'locale': 'ur_PK',
            'value': 'کلید'
          },
          {
            'locale': 'vi_VN',
            'value': 'Chìa khóa'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Isitshixo'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '关键'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '密钥'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '密钥'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '鑰匙'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '密鑰'
          },
          {
            'locale': 'ar_EG',
            'value': 'المفتاح'
          },
          {
            'locale': 'es_PR',
            'value': 'Clave'
          },
          {
            'locale': 'es_PA',
            'value': 'Clave'
          },
          {
            'locale': 'hil_PH',
            'value': 'Key'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Key'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Selotlolo'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵜⴰⵙⴰⵔⵓⵜ'
          }
        ],
        'name': 'c_key',
        'properties': []
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Name'
          },
          {
            'locale': 'af_ZA',
            'value': 'Naam'
          },
          {
            'locale': 'ar_SA',
            'value': 'الاسم'
          },
          {
            'locale': 'bg_BG',
            'value': 'Име'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Jméno'
          },
          {
            'locale': 'da_DK',
            'value': 'Navn'
          },
          {
            'locale': 'de_CH',
            'value': 'Name'
          },
          {
            'locale': 'de_DE',
            'value': 'Name'
          },
          {
            'locale': 'el_GR',
            'value': 'Όνομα'
          },
          {
            'locale': 'es_ES',
            'value': 'Nombre'
          },
          {
            'locale': 'es_MX',
            'value': 'Nombre'
          },
          {
            'locale': 'es_US',
            'value': 'Nombre'
          },
          {
            'locale': 'fr_BE',
            'value': 'Nom'
          },
          {
            'locale': 'fr_CA',
            'value': 'Nom'
          },
          {
            'locale': 'fr_CH',
            'value': 'Nom'
          },
          {
            'locale': 'fr_FR',
            'value': 'Nom'
          },
          {
            'locale': 'he_IL',
            'value': 'שם'
          },
          {
            'locale': 'hu_HU',
            'value': 'Név'
          },
          {
            'locale': 'it_IT',
            'value': 'Nome'
          },
          {
            'locale': 'ja_JP',
            'value': '氏名'
          },
          {
            'locale': 'ka_GE',
            'value': 'სახელწოდება'
          },
          {
            'locale': 'ko_KR',
            'value': '이름'
          },
          {
            'locale': 'lt_LT',
            'value': 'Pavadinimas'
          },
          {
            'locale': 'lv_LV',
            'value': 'Vārds un uzvārds'
          },
          {
            'locale': 'ms_MY',
            'value': 'Nama'
          },
          {
            'locale': 'nl_BE',
            'value': 'Naam'
          },
          {
            'locale': 'nl_NL',
            'value': 'Naam'
          },
          {
            'locale': 'pl_PL',
            'value': 'Imię i nazwisko'
          },
          {
            'locale': 'pt_BR',
            'value': 'Nome'
          },
          {
            'locale': 'pt_PT',
            'value': 'Nome'
          },
          {
            'locale': 'ro_RO',
            'value': 'Denumire'
          },
          {
            'locale': 'ru_RU',
            'value': 'Имя и фамилия'
          },
          {
            'locale': 'ru_UA',
            'value': 'Имя и фамилия'
          },
          {
            'locale': 'sk_SK',
            'value': 'Názov'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Naziv'
          },
          {
            'locale': 'st_ZA',
            'value': 'Lebitso'
          },
          {
            'locale': 'sv_SE',
            'value': 'Namn'
          },
          {
            'locale': 'tr_TR',
            'value': 'Ad'
          },
          {
            'locale': 'uk_UA',
            'value': "Ім'я"
          },
          {
            'locale': 'zh_CN',
            'value': '姓名'
          },
          {
            'locale': 'zh_TW',
            'value': '姓名：'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Igama'
          },
          {
            'locale': 'gu_IN',
            'value': 'નામ'
          },
          {
            'locale': 'hi_IN',
            'value': 'नाम'
          },
          {
            'locale': 'kn_IN',
            'value': 'ಹೆಸರು'
          },
          {
            'locale': 'ml_IN',
            'value': 'പേര്'
          },
          {
            'locale': 'mr_IN',
            'value': 'नाव'
          },
          {
            'locale': 'or_IN',
            'value': 'ନାମ'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਨਾਮ'
          },
          {
            'locale': 'ta_IN',
            'value': 'பெயர்'
          },
          {
            'locale': 'te_IN',
            'value': 'పేరు'
          },
          {
            'locale': 'th_TH',
            'value': 'ชื่อ'
          },
          {
            'locale': 'bn_IN',
            'value': 'নাম'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Ngalan'
          },
          {
            'locale': 'de_AT',
            'value': 'Name'
          },
          {
            'locale': 'en_AU',
            'value': 'Name'
          },
          {
            'locale': 'en_CA',
            'value': 'Name'
          },
          {
            'locale': 'en_GB',
            'value': 'Name'
          },
          {
            'locale': 'en_NZ',
            'value': 'Name'
          },
          {
            'locale': 'hr_HR',
            'value': 'ime i prezime'
          },
          {
            'locale': 'sl_SI',
            'value': 'Ime'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Назив'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Ime'
          },
          {
            'locale': 'tl_PH',
            'value': 'Pangalan'
          },
          {
            'locale': 'ar_DZ',
            'value': 'الاسم'
          },
          {
            'locale': 'ar_IL',
            'value': 'الاسم'
          },
          {
            'locale': 'ar_LB',
            'value': 'الاسم'
          },
          {
            'locale': 'as_IN',
            'value': 'নাম'
          },
          {
            'locale': 'ca_ES',
            'value': 'Nom'
          },
          {
            'locale': 'de_BE',
            'value': 'Name'
          },
          {
            'locale': 'en_BE',
            'value': 'Name'
          },
          {
            'locale': 'en_HK',
            'value': 'Name'
          },
          {
            'locale': 'en_IE',
            'value': 'Name'
          },
          {
            'locale': 'en_IL',
            'value': 'Name'
          },
          {
            'locale': 'en_IN',
            'value': 'Name'
          },
          {
            'locale': 'en_JM',
            'value': 'Name'
          },
          {
            'locale': 'en_MY',
            'value': 'Name'
          },
          {
            'locale': 'en_PH',
            'value': 'Name'
          },
          {
            'locale': 'en_SG',
            'value': 'Name'
          },
          {
            'locale': 'en_ZA',
            'value': 'Name'
          },
          {
            'locale': 'es_419',
            'value': 'Nombre'
          },
          {
            'locale': 'es_AR',
            'value': 'Nombre'
          },
          {
            'locale': 'es_CL',
            'value': 'Nombre'
          },
          {
            'locale': 'es_CO',
            'value': 'Nombre'
          },
          {
            'locale': 'es_GT',
            'value': 'Nombre'
          },
          {
            'locale': 'es_PE',
            'value': 'Nombre'
          },
          {
            'locale': 'et_EE',
            'value': 'Nimi'
          },
          {
            'locale': 'fi_FI',
            'value': 'Nimi'
          },
          {
            'locale': 'fil_PH',
            'value': 'Pangalan'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Nom'
          },
          {
            'locale': 'gl_ES',
            'value': 'Nome'
          },
          {
            'locale': 'it_CH',
            'value': 'Nome'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'نام'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Nama'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Nama'
          },
          {
            'locale': 'nn_NO',
            'value': 'Navn'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Leina'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਨਾਮ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Denumire'
          },
          {
            'locale': 'ru_EE',
            'value': 'Имя и фамилия'
          },
          {
            'locale': 'ru_IL',
            'value': 'Имя и фамилия'
          },
          {
            'locale': 'ru_LT',
            'value': 'Имя и фамилия'
          },
          {
            'locale': 'ru_LV',
            'value': 'Имя и фамилия'
          },
          {
            'locale': 'si_LK',
            'value': 'නම'
          },
          {
            'locale': 'sv_FI',
            'value': 'Namn'
          },
          {
            'locale': 'ta_LK',
            'value': 'பெயர்'
          },
          {
            'locale': 'ta_MY',
            'value': 'பெயர்'
          },
          {
            'locale': 'ta_SG',
            'value': 'பெயர்'
          },
          {
            'locale': 'ur_IN',
            'value': 'نام'
          },
          {
            'locale': 'ur_PK',
            'value': 'نام'
          },
          {
            'locale': 'vi_VN',
            'value': 'Tên'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Igama'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '名称'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '姓名'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '名称'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '姓名'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '姓名'
          },
          {
            'locale': 'ar_EG',
            'value': 'الاسم'
          },
          {
            'locale': 'es_PR',
            'value': 'Nombre'
          },
          {
            'locale': 'es_PA',
            'value': 'Nombre'
          },
          {
            'locale': 'hil_PH',
            'value': 'Ngalan'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Nagan'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Leina'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵉⵙⵎ'
          }
        ],
        'name': 'c_name',
        'properties': []
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Number'
          },
          {
            'locale': 'af_ZA',
            'value': 'Nommer'
          },
          {
            'locale': 'ar_SA',
            'value': 'الرقم'
          },
          {
            'locale': 'bg_BG',
            'value': 'Номер'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Číslo'
          },
          {
            'locale': 'da_DK',
            'value': 'Nummer'
          },
          {
            'locale': 'de_CH',
            'value': 'Zahl'
          },
          {
            'locale': 'de_DE',
            'value': 'Zahl'
          },
          {
            'locale': 'el_GR',
            'value': 'Αριθμός'
          },
          {
            'locale': 'es_ES',
            'value': 'Número'
          },
          {
            'locale': 'es_MX',
            'value': 'Número'
          },
          {
            'locale': 'es_US',
            'value': 'Número'
          },
          {
            'locale': 'fr_BE',
            'value': 'Nombre'
          },
          {
            'locale': 'fr_CA',
            'value': 'Nombre'
          },
          {
            'locale': 'fr_CH',
            'value': 'Nombre'
          },
          {
            'locale': 'fr_FR',
            'value': 'Nombre'
          },
          {
            'locale': 'he_IL',
            'value': 'מספר'
          },
          {
            'locale': 'hu_HU',
            'value': 'Szám'
          },
          {
            'locale': 'it_IT',
            'value': 'Numero'
          },
          {
            'locale': 'ja_JP',
            'value': '番号'
          },
          {
            'locale': 'ka_GE',
            'value': 'ნომერი'
          },
          {
            'locale': 'ko_KR',
            'value': '번호'
          },
          {
            'locale': 'lt_LT',
            'value': 'Numeris'
          },
          {
            'locale': 'lv_LV',
            'value': 'Numurs'
          },
          {
            'locale': 'ms_MY',
            'value': 'Nombor'
          },
          {
            'locale': 'nl_BE',
            'value': 'Nummer'
          },
          {
            'locale': 'nl_NL',
            'value': 'Nummer'
          },
          {
            'locale': 'pl_PL',
            'value': 'Numer'
          },
          {
            'locale': 'pt_BR',
            'value': 'Número'
          },
          {
            'locale': 'pt_PT',
            'value': 'Número'
          },
          {
            'locale': 'ro_RO',
            'value': 'Număr'
          },
          {
            'locale': 'ru_RU',
            'value': 'Номер'
          },
          {
            'locale': 'ru_UA',
            'value': 'Номер'
          },
          {
            'locale': 'sk_SK',
            'value': 'Číslo'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Broj'
          },
          {
            'locale': 'st_ZA',
            'value': 'Palo'
          },
          {
            'locale': 'sv_SE',
            'value': 'Antal'
          },
          {
            'locale': 'tr_TR',
            'value': 'Sayı'
          },
          {
            'locale': 'uk_UA',
            'value': 'Номер'
          },
          {
            'locale': 'zh_CN',
            'value': '数字'
          },
          {
            'locale': 'zh_TW',
            'value': '數目'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Inombolo'
          },
          {
            'locale': 'gu_IN',
            'value': 'નંબર'
          },
          {
            'locale': 'hi_IN',
            'value': 'नंबर'
          },
          {
            'locale': 'kn_IN',
            'value': 'ಸಂಖ್ಯೆ'
          },
          {
            'locale': 'ml_IN',
            'value': 'നമ്പർ'
          },
          {
            'locale': 'mr_IN',
            'value': 'क्रमांक'
          },
          {
            'locale': 'or_IN',
            'value': 'ସଂଖ୍ୟା'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਨੰਬਰ'
          },
          {
            'locale': 'ta_IN',
            'value': 'எண்'
          },
          {
            'locale': 'te_IN',
            'value': 'నెంబరు'
          },
          {
            'locale': 'th_TH',
            'value': 'หมายเลข'
          },
          {
            'locale': 'bn_IN',
            'value': 'সংখ্যা'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Numero'
          },
          {
            'locale': 'de_AT',
            'value': 'Zahl'
          },
          {
            'locale': 'en_AU',
            'value': 'Number'
          },
          {
            'locale': 'en_CA',
            'value': 'Number'
          },
          {
            'locale': 'en_GB',
            'value': 'Number'
          },
          {
            'locale': 'en_NZ',
            'value': 'Number'
          },
          {
            'locale': 'hr_HR',
            'value': 'Broj'
          },
          {
            'locale': 'sl_SI',
            'value': 'Številka'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Број'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Broj'
          },
          {
            'locale': 'tl_PH',
            'value': 'Numero'
          },
          {
            'locale': 'ar_DZ',
            'value': 'رقم'
          },
          {
            'locale': 'ar_IL',
            'value': 'رقم'
          },
          {
            'locale': 'ar_LB',
            'value': 'رقم'
          },
          {
            'locale': 'as_IN',
            'value': 'সংখ্যা'
          },
          {
            'locale': 'ca_ES',
            'value': 'Número'
          },
          {
            'locale': 'de_BE',
            'value': 'Zahl'
          },
          {
            'locale': 'en_BE',
            'value': 'Number'
          },
          {
            'locale': 'en_HK',
            'value': 'Number'
          },
          {
            'locale': 'en_IE',
            'value': 'Number'
          },
          {
            'locale': 'en_IL',
            'value': 'Number'
          },
          {
            'locale': 'en_IN',
            'value': 'Number'
          },
          {
            'locale': 'en_JM',
            'value': 'Number'
          },
          {
            'locale': 'en_MY',
            'value': 'Number'
          },
          {
            'locale': 'en_PH',
            'value': 'Number'
          },
          {
            'locale': 'en_SG',
            'value': 'Number'
          },
          {
            'locale': 'en_ZA',
            'value': 'Number'
          },
          {
            'locale': 'es_419',
            'value': 'Número'
          },
          {
            'locale': 'es_AR',
            'value': 'Número'
          },
          {
            'locale': 'es_CL',
            'value': 'Número'
          },
          {
            'locale': 'es_CO',
            'value': 'Número'
          },
          {
            'locale': 'es_GT',
            'value': 'Número'
          },
          {
            'locale': 'es_PE',
            'value': 'Número'
          },
          {
            'locale': 'et_EE',
            'value': 'Number'
          },
          {
            'locale': 'fi_FI',
            'value': 'Numero'
          },
          {
            'locale': 'fil_PH',
            'value': 'Numero'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Nombre'
          },
          {
            'locale': 'gl_ES',
            'value': 'Número'
          },
          {
            'locale': 'it_CH',
            'value': 'Numero'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'نومبور'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Nombor'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Nombor'
          },
          {
            'locale': 'nn_NO',
            'value': 'Nummer'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Nomoro'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਗਿਣਤੀ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Număr'
          },
          {
            'locale': 'ru_EE',
            'value': 'Номер'
          },
          {
            'locale': 'ru_IL',
            'value': 'Номер'
          },
          {
            'locale': 'ru_LT',
            'value': 'Номер'
          },
          {
            'locale': 'ru_LV',
            'value': 'Номер'
          },
          {
            'locale': 'si_LK',
            'value': 'සංඛ්‍යාව'
          },
          {
            'locale': 'sv_FI',
            'value': 'Nummer'
          },
          {
            'locale': 'ta_LK',
            'value': 'எண்'
          },
          {
            'locale': 'ta_MY',
            'value': 'எண்'
          },
          {
            'locale': 'ta_SG',
            'value': 'எண்'
          },
          {
            'locale': 'ur_IN',
            'value': 'نمبر'
          },
          {
            'locale': 'ur_PK',
            'value': 'نمبر'
          },
          {
            'locale': 'vi_VN',
            'value': 'Số'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Inombolo'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '数'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '编号'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '编号'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '數字'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '數目'
          },
          {
            'locale': 'ar_EG',
            'value': 'الرقم'
          },
          {
            'locale': 'es_PR',
            'value': 'Número'
          },
          {
            'locale': 'es_PA',
            'value': 'Número'
          },
          {
            'locale': 'hil_PH',
            'value': 'Numero'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Numero'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Nomoro'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵓⵜⵜⵓⵏ'
          }
        ],
        'name': 'c_number',
        'properties': []
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'af_ZA',
            'value': 'Prinsipaal Ondersoeker Naam'
          },
          {
            'locale': 'ar_SA',
            'value': 'اسم الباحث الرئيس'
          },
          {
            'locale': 'bg_BG',
            'value': 'Име на главен изследовател'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Jméno hlavního řešitele'
          },
          {
            'locale': 'da_DK',
            'value': 'Primær investigators navn'
          },
          {
            'locale': 'de_CH',
            'value': 'Name des Hauptprüfers'
          },
          {
            'locale': 'de_DE',
            'value': 'Name des Hauptprüfers'
          },
          {
            'locale': 'el_GR',
            'value': 'Όνομα Κυρίου Ερευνητή'
          },
          {
            'locale': 'es_ES',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_MX',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_US',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'fr_BE',
            'value': 'Nom de l’investigateur principal'
          },
          {
            'locale': 'fr_CA',
            'value': 'Nom de l’enquêteur principal'
          },
          {
            'locale': 'fr_CH',
            'value': 'Nom de l’investigateur principal'
          },
          {
            'locale': 'fr_FR',
            'value': 'Nom de l’investigateur principal'
          },
          {
            'locale': 'he_IL',
            'value': 'שם חוקר ראשי'
          },
          {
            'locale': 'hu_HU',
            'value': 'Vizsgálatvezető neve'
          },
          {
            'locale': 'it_IT',
            'value': 'Nome dello sperimentatore principale'
          },
          {
            'locale': 'ja_JP',
            'value': '治験責任医師名'
          },
          {
            'locale': 'ka_GE',
            'value': 'მთავარი მკვლევრის სახელი და გვარი'
          },
          {
            'locale': 'ko_KR',
            'value': '주요 조사자 이름'
          },
          {
            'locale': 'lt_LT',
            'value': 'Pagrindinio tyrėjo vardas ir pavardė'
          },
          {
            'locale': 'lv_LV',
            'value': 'Galvenā pētnieka vārds'
          },
          {
            'locale': 'ms_MY',
            'value': 'Nama Penyelidik Utama'
          },
          {
            'locale': 'nl_BE',
            'value': 'Naam hoofdonderzoeker'
          },
          {
            'locale': 'nl_NL',
            'value': 'Naam hoofdonderzoeker'
          },
          {
            'locale': 'pl_PL',
            'value': 'Imię i nazwisko głównego badacza'
          },
          {
            'locale': 'pt_BR',
            'value': 'Nome do investigador principal'
          },
          {
            'locale': 'pt_PT',
            'value': 'Nome do investigador principal'
          },
          {
            'locale': 'ro_RO',
            'value': 'Nume investigator principal'
          },
          {
            'locale': 'ru_RU',
            'value': 'Имя и фамилия главного исследователя'
          },
          {
            'locale': 'ru_UA',
            'value': 'Имя и фамилия главного исследователя'
          },
          {
            'locale': 'sk_SK',
            'value': 'Meno hlavného skúšajúceho'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Ime glavnog istraživača'
          },
          {
            'locale': 'st_ZA',
            'value': 'Lebitso la Mofuputsi ya Ka Sehloohong'
          },
          {
            'locale': 'sv_SE',
            'value': 'Huvudprövarens namn'
          },
          {
            'locale': 'tr_TR',
            'value': 'Sorumlu Araştırmacı Adı'
          },
          {
            'locale': 'uk_UA',
            'value': 'П.І.Б. головного дослідника'
          },
          {
            'locale': 'zh_CN',
            'value': '主要调查者姓名'
          },
          {
            'locale': 'zh_TW',
            'value': '主要調查者姓名'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Igama Lomphenyi Oyinhloko'
          },
          {
            'locale': 'gu_IN',
            'value': 'મુખ્ય તપાસકર્તાનું નામ'
          },
          {
            'locale': 'hi_IN',
            'value': 'मुख्य अन्वेषक का नाम'
          },
          {
            'locale': 'kn_IN',
            'value': 'ಪ್ರಧಾನ ಪರಿಶೊಧಕರ ಹೆಸರು'
          },
          {
            'locale': 'ml_IN',
            'value': 'പ്രധാന അന്വേഷകന്റെ പേര്'
          },
          {
            'locale': 'mr_IN',
            'value': 'प्रधान अन्वेषकाचे नाव'
          },
          {
            'locale': 'or_IN',
            'value': 'ମୁଖ୍ୟ ଅନୁସନ୍ଧାନକାରୀ ନାମ'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਮੁੱਖ ਜਾਂਚਕਰਤਾ ਦਾ ਨਾਮ'
          },
          {
            'locale': 'ta_IN',
            'value': 'முதன்மை ஆய்வாளர் பெயர்'
          },
          {
            'locale': 'te_IN',
            'value': 'ప్రధాన పరిశోధకుని పేరు'
          },
          {
            'locale': 'th_TH',
            'value': 'ชื่อผู้วิจัยหลัก'
          },
          {
            'locale': 'bn_IN',
            'value': 'প্রধান অনুসন্ধানকারীর নাম'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Ngalan sa Prinsipal nga Imbestigador'
          },
          {
            'locale': 'de_AT',
            'value': 'Name des Hauptprüfers'
          },
          {
            'locale': 'en_AU',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_CA',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_GB',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_NZ',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'hr_HR',
            'value': 'Ime glavnog ispitivača'
          },
          {
            'locale': 'sl_SI',
            'value': 'Ime glavnega raziskovalca'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Име главног истраживача'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Ime glavnog istraživača'
          },
          {
            'locale': 'tl_PH',
            'value': 'Pangalan ng Pangunahing Imbestigador'
          },
          {
            'locale': 'ar_DZ',
            'value': 'اسم الباحث الرئيسي'
          },
          {
            'locale': 'ar_IL',
            'value': 'اسم الباحث الرئيسي'
          },
          {
            'locale': 'ar_LB',
            'value': 'اسم الباحث الرئيسي'
          },
          {
            'locale': 'as_IN',
            'value': 'মুখ্য অন্বেষকৰ নাম'
          },
          {
            'locale': 'ca_ES',
            'value': 'Nom de l’investigador principal'
          },
          {
            'locale': 'de_BE',
            'value': 'Name des Hauptprüfers'
          },
          {
            'locale': 'en_BE',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_HK',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_IE',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_IL',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_IN',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_JM',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_MY',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_PH',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_SG',
            'value': 'Principal Investigator Name'
          },
          {
            'locale': 'en_ZA',
            'value': 'Principal investigator name'
          },
          {
            'locale': 'es_419',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_AR',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_CL',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_CO',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_GT',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_PE',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'et_EE',
            'value': 'Peauurija nimi'
          },
          {
            'locale': 'fi_FI',
            'value': 'Päätoimisen tutkijan nimi'
          },
          {
            'locale': 'fil_PH',
            'value': 'Pangalan ng Punong Imbestigador'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Nom de l’investigateur principal'
          },
          {
            'locale': 'gl_ES',
            'value': 'Nome do investigador principal'
          },
          {
            'locale': 'it_CH',
            'value': 'Nome sperimentatore principale'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'نام کتوا ڤڽياست'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Nama Penyiasat Utama'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Nama Penyiasat Utama'
          },
          {
            'locale': 'nn_NO',
            'value': 'Navn på forskningsleder'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Leina la Monyakišiši-Hlogo'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਪ੍ਰਮੁੱਖ ਜਾਂਚਕਰਤਾ ਦਾ ਨਾਮ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Nume investigator principal'
          },
          {
            'locale': 'ru_EE',
            'value': 'Имя и фамилия главного исследователя'
          },
          {
            'locale': 'ru_IL',
            'value': 'Имя и фамилия главного исследователя'
          },
          {
            'locale': 'ru_LT',
            'value': 'Имя и фамилия главного исследователя'
          },
          {
            'locale': 'ru_LV',
            'value': 'Имя и фамилия главного исследователя'
          },
          {
            'locale': 'si_LK',
            'value': 'ප්‍රධාන පර්යේෂකගේ නම'
          },
          {
            'locale': 'sv_FI',
            'value': 'Namn på huvudforskare'
          },
          {
            'locale': 'ta_LK',
            'value': 'முதன்மை ஆய்வாளர் பெயர்'
          },
          {
            'locale': 'ta_MY',
            'value': 'முதன்மை ஆய்வாளர் பெயர்'
          },
          {
            'locale': 'ta_SG',
            'value': 'முதன்மை ஆய்வாளர் பெயர்'
          },
          {
            'locale': 'ur_IN',
            'value': 'صدر تحقیق کنندہ کا نام'
          },
          {
            'locale': 'ur_PK',
            'value': 'بنیادی تحقیق کار'
          },
          {
            'locale': 'vi_VN',
            'value': 'Tên điều tra viên chính'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Igama Lomphandi Oyintloko'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '首席调查员姓名'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '主要研究者姓名'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '主要研究者姓名'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '首席研究員姓名'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '試驗主持人姓名'
          },
          {
            'locale': 'ar_EG',
            'value': 'اسم الباحث الرئيس'
          },
          {
            'locale': 'es_PR',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'es_PA',
            'value': 'Nombre del investigador principal'
          },
          {
            'locale': 'hil_PH',
            'value': 'Ngalan sang Prinsipal nga Imbestigador'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Nagan ti Kangrunaan nga Imbestigador'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Leina la Mmatlisisimogolo'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵉⵙⵎ ⵏ ⵓⵎⵏⴰⴷⵉ ⴰⴳⴻⵊⴷⴰⵏ'
          }
        ],
        'name': 'c_pi_name',
        'properties': []
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Time Zone'
          }
        ],
        'name': 'c_tz',
        'properties': []
      },
      {
        'description': [],
        'documents': [],
        'label': [
          {
            'locale': 'en_US',
            'value': 'Supported Locales'
          },
          {
            'locale': 'af_ZA',
            'value': 'Ondersteunde Plekke'
          },
          {
            'locale': 'ar_SA',
            'value': 'الإعدادات المحلية المدعمة'
          },
          {
            'locale': 'bg_BG',
            'value': 'Поддържани регионални настройки'
          },
          {
            'locale': 'cs_CZ',
            'value': 'Podporované místní prostředí'
          },
          {
            'locale': 'da_DK',
            'value': 'Støttede lokaliteter'
          },
          {
            'locale': 'de_CH',
            'value': 'Unterstützte Standorte'
          },
          {
            'locale': 'de_DE',
            'value': 'Unterstützte Standorte'
          },
          {
            'locale': 'el_GR',
            'value': 'Υποστηριζόμενες τοπικές ρυθμίσεις'
          },
          {
            'locale': 'es_ES',
            'value': 'Configuraciones regionales'
          },
          {
            'locale': 'es_MX',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'es_US',
            'value': 'Configuraciones regionales admitidas'
          },
          {
            'locale': 'fr_BE',
            'value': 'Paramètres régionaux pris en charge'
          },
          {
            'locale': 'fr_CA',
            'value': 'Paramètres régionaux pris en charge'
          },
          {
            'locale': 'fr_CH',
            'value': 'Paramètres régionaux pris en charge'
          },
          {
            'locale': 'fr_FR',
            'value': 'Paramètres régionaux pris en charge'
          },
          {
            'locale': 'he_IL',
            'value': 'שפות מקומיות נתמכות'
          },
          {
            'locale': 'hu_HU',
            'value': 'Támogatott helyszínek'
          },
          {
            'locale': 'it_IT',
            'value': 'Impostazioni locali supportate'
          },
          {
            'locale': 'ja_JP',
            'value': 'サポートされているロケール'
          },
          {
            'locale': 'ka_GE',
            'value': 'მხარდაჭერილი რეგიონული პარამეტრები'
          },
          {
            'locale': 'ko_KR',
            'value': '지원된 로케일'
          },
          {
            'locale': 'lt_LT',
            'value': 'Palaikomos lokalės'
          },
          {
            'locale': 'lv_LV',
            'value': 'Atbalstītās lokalizācijas'
          },
          {
            'locale': 'ms_MY',
            'value': 'Penempatan yang Disokong'
          },
          {
            'locale': 'nl_BE',
            'value': 'Ondersteunde landinstellingen'
          },
          {
            'locale': 'nl_NL',
            'value': 'Ondersteunde locaties'
          },
          {
            'locale': 'pl_PL',
            'value': 'Obsługiwane ustawienia regionalne'
          },
          {
            'locale': 'pt_BR',
            'value': 'Locais suportados'
          },
          {
            'locale': 'pt_PT',
            'value': 'Locais com suporte'
          },
          {
            'locale': 'ro_RO',
            'value': 'Localizări acceptate'
          },
          {
            'locale': 'ru_RU',
            'value': 'Поддерживаемые регионы'
          },
          {
            'locale': 'ru_UA',
            'value': 'Поддерживаемые регионы'
          },
          {
            'locale': 'sk_SK',
            'value': 'Podporované miestne nastavenia'
          },
          {
            'locale': 'sr_Latn_RS',
            'value': 'Podržani lokalni standardi'
          },
          {
            'locale': 'st_ZA',
            'value': 'Dibaka tsa Lehae tse Tsheheditsweng'
          },
          {
            'locale': 'sv_SE',
            'value': 'Platser som stöds'
          },
          {
            'locale': 'tr_TR',
            'value': 'Desteklenen Yerler'
          },
          {
            'locale': 'uk_UA',
            'value': 'Підтримувані мови'
          },
          {
            'locale': 'zh_CN',
            'value': '支持的地区'
          },
          {
            'locale': 'zh_TW',
            'value': '支持的地區'
          },
          {
            'locale': 'zu_ZA',
            'value': 'Izindawo Ezisekelwayo'
          },
          {
            'locale': 'gu_IN',
            'value': 'સમર્થિત ઘટના સ્થળ'
          },
          {
            'locale': 'hi_IN',
            'value': 'समर्थित स्थान'
          },
          {
            'locale': 'kn_IN',
            'value': 'ಬೆಂಬಲಿತ ಸ್ಥಳಗಳು'
          },
          {
            'locale': 'ml_IN',
            'value': 'പിന്തുണയ്ക്കുന്ന സ്ഥലങ്ങൾ'
          },
          {
            'locale': 'mr_IN',
            'value': 'समर्थित लोकेल्स'
          },
          {
            'locale': 'or_IN',
            'value': 'ସମର୍ଥିତ ଲୋକାଲ୍'
          },
          {
            'locale': 'pa_IN',
            'value': 'ਲੋਕੇਲ ਦਾ ਸਮਰਥਨ ਕੀਤਾ ਗਿਆ'
          },
          {
            'locale': 'ta_IN',
            'value': 'ஆதரிக்கப்படும் மொழிகள்'
          },
          {
            'locale': 'te_IN',
            'value': 'మద్దతుగల స్థానిక ప్రదేశాలు'
          },
          {
            'locale': 'th_TH',
            'value': 'ตำแหน่งที่รองรับ'
          },
          {
            'locale': 'bn_IN',
            'value': 'সমর্থিত লোকেল'
          },
          {
            'locale': 'ceb_PH',
            'value': 'Mga Gisuportahan nga Lokal'
          },
          {
            'locale': 'de_AT',
            'value': 'Unterstützte Standorte'
          },
          {
            'locale': 'en_AU',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_CA',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_GB',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_NZ',
            'value': 'Supported Locales'
          },
          {
            'locale': 'hr_HR',
            'value': 'Podržane lokacije'
          },
          {
            'locale': 'sl_SI',
            'value': 'Podprte lokacije'
          },
          {
            'locale': 'sr_Cyrl_RS',
            'value': 'Подржани локални стандарди'
          },
          {
            'locale': 'sr_Latn',
            'value': 'Podržani lokalni standardi'
          },
          {
            'locale': 'tl_PH',
            'value': 'Suportadong mga Locale'
          },
          {
            'locale': 'ar_DZ',
            'value': 'اللغات المدعومة'
          },
          {
            'locale': 'ar_IL',
            'value': 'اللغات المدعومة'
          },
          {
            'locale': 'ar_LB',
            'value': 'اللغات المدعومة'
          },
          {
            'locale': 'as_IN',
            'value': 'সমৰ্থিত লোকলবোৰ'
          },
          {
            'locale': 'ca_ES',
            'value': 'Locals compatibles'
          },
          {
            'locale': 'de_BE',
            'value': 'Unterstützte Standorte'
          },
          {
            'locale': 'en_BE',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_HK',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_IE',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_IL',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_IN',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_JM',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_MY',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_PH',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_SG',
            'value': 'Supported Locales'
          },
          {
            'locale': 'en_ZA',
            'value': 'Supported locales'
          },
          {
            'locale': 'es_419',
            'value': 'Supported Locales'
          },
          {
            'locale': 'es_AR',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'es_CL',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'es_CO',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'es_GT',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'es_PE',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'et_EE',
            'value': 'Toetatavad lokaadid'
          },
          {
            'locale': 'fi_FI',
            'value': 'Tuetut alueet'
          },
          {
            'locale': 'fil_PH',
            'value': 'Mga Sinusuportahang Lokal'
          },
          {
            'locale': 'fr_DZ',
            'value': 'Paramètres régionaux pris en charge'
          },
          {
            'locale': 'gl_ES',
            'value': 'Locais compatibles'
          },
          {
            'locale': 'it_CH',
            'value': 'Impostazioni locali supportate'
          },
          {
            'locale': 'ms_Arab_MY',
            'value': 'تمڤتن دسوکوڠ'
          },
          {
            'locale': 'ms_Latn_MY',
            'value': 'Penempatan Disokong'
          },
          {
            'locale': 'ms_Latn_SG',
            'value': 'Penempatan Disokong'
          },
          {
            'locale': 'nn_NO',
            'value': 'Steder som støttes'
          },
          {
            'locale': 'nso_ZA',
            'value': 'Mafelo ao a Thekgwago'
          },
          {
            'locale': 'pa_Guru_IN',
            'value': 'ਸਮਰਥਿਤ ਲੋਕੇਲਸ'
          },
          {
            'locale': 'ro_MD',
            'value': 'Localizări acceptate'
          },
          {
            'locale': 'ru_EE',
            'value': 'Поддерживаемые регионы'
          },
          {
            'locale': 'ru_IL',
            'value': 'Поддерживаемые регионы'
          },
          {
            'locale': 'ru_LT',
            'value': 'Поддерживаемые регионы'
          },
          {
            'locale': 'ru_LV',
            'value': 'Поддерживаемые регионы'
          },
          {
            'locale': 'si_LK',
            'value': 'සහාය දක්වන පෙදෙසි'
          },
          {
            'locale': 'sv_FI',
            'value': 'Språkversioner som stöds'
          },
          {
            'locale': 'ta_LK',
            'value': 'ஆதரிக்கப்பட்ட வட்டாரங்கள்'
          },
          {
            'locale': 'ta_MY',
            'value': 'ஆதரிக்கப்படும் இடங்கள்'
          },
          {
            'locale': 'ta_SG',
            'value': 'ஆதரிக்கப்படும் இடங்கள்'
          },
          {
            'locale': 'ur_IN',
            'value': 'اعانت یافتہ مقامی خاصیات'
          },
          {
            'locale': 'ur_PK',
            'value': 'معاونت کردہ لوکلز'
          },
          {
            'locale': 'vi_VN',
            'value': 'Thiết đặt bản địa được hỗ trợ'
          },
          {
            'locale': 'xh_ZA',
            'value': 'Iindawo Ezixhaswayo'
          },
          {
            'locale': 'zh_Hans_CN',
            'value': '受支持地点'
          },
          {
            'locale': 'zh_Hans_MY',
            'value': '支持的区域设置'
          },
          {
            'locale': 'zh_Hans_SG',
            'value': '支持的区域设置'
          },
          {
            'locale': 'zh_Hant_HK',
            'value': '支持的語言環境'
          },
          {
            'locale': 'zh_Hant_TW',
            'value': '支援的地區設定'
          },
          {
            'locale': 'ar_EG',
            'value': 'الإعدادات المحلية المدعمة'
          },
          {
            'locale': 'es_PR',
            'value': 'Configuraciones regionales admitidas'
          },
          {
            'locale': 'es_PA',
            'value': 'Configuraciones locales admitidas'
          },
          {
            'locale': 'hil_PH',
            'value': 'Suportado nga mga Lokal'
          },
          {
            'locale': 'ilo_PH',
            'value': 'Dagiti Suportado a Disso'
          },
          {
            'locale': 'tn_ZA',
            'value': 'Mafelo a a Tshegetshwang'
          },
          {
            'locale': 'zgh_DZ',
            'value': 'ⵉⵎⵓⴽⴰⵏ ⵢⴻⵜⵜⵡⴰⴷⴻⵄⵎⴻⵏ'
          }
        ],
        'name': 'c_supported_locales',
        'properties': []
      }
    ]
  },
  'localized': true,
  'name': 'c_site',
  'object': 'object',
  'objectTypes': [],
  'properties': [
    {
      'acl': [],
      'aclOverride': false,
      'array': true,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'label': 'Addresses',
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_addresses',
      'optional': false,
      'properties': [
        {
          'acl': [],
          'aclOverride': false,
          'array': false,
          'auditable': false,
          'autoGenerate': true,
          'canPull': true,
          'canPush': true,
          'creatable': false,
          'defaultValue': [],
          'dependencies': [],
          'history': false,
          'indexed': false,
          'label': 'Key',
          'maxItems': 100,
          'maxShift': false,
          'minItems': 0,
          'name': 'c_key',
          'optional': false,
          'readAccess': 'read',
          'readable': true,
          'removable': false,
          'type': 'UUID',
          'unique': false,
          'uniqueValues': false,
          'uuidVersion': 4,
          'validators': [
            {
              'name': 'uniqueInArray'
            }
          ],
          'writable': true,
          'writeAccess': 'update',
          'writeOnCreate': true
        },
        {
          'acl': [],
          'aclOverride': false,
          'array': true,
          'auditable': false,
          'canPull': true,
          'canPush': true,
          'creatable': false,
          'defaultValue': [],
          'dependencies': [],
          'history': false,
          'indexed': false,
          'label': 'Line',
          'localization': {
            'acl': [],
            'aclOverride': false,
            'enabled': false,
            'fallback': true,
            'fixed': '',
            'readAccess': 'read',
            'strict': true,
            'valid': [],
            'writeAccess': 'update'
          },
          'lowercase': false,
          'maxItems': 100,
          'maxShift': false,
          'minItems': 0,
          'name': 'c_line',
          'optional': false,
          'readAccess': 'read',
          'readable': true,
          'removable': false,
          'trim': false,
          'type': 'String',
          'unique': false,
          'uniqueValues': false,
          'uppercase': false,
          'validators': [
            {
              'name': 'required'
            },
            {
              'definition': {
                'min': 0,
                'max': 512
              },
              'name': 'string'
            }
          ],
          'writable': true,
          'writeAccess': 'update',
          'writeOnCreate': true
        },
        {
          'acl': [],
          'aclOverride': false,
          'array': false,
          'auditable': false,
          'canPull': true,
          'canPush': true,
          'creatable': false,
          'defaultValue': [],
          'dependencies': [],
          'history': false,
          'indexed': false,
          'label': 'Type',
          'maxItems': 100,
          'maxShift': false,
          'minItems': 0,
          'name': 'c_type',
          'optional': false,
          'readAccess': 'read',
          'readable': true,
          'removable': false,
          'type': 'Number',
          'unique': false,
          'uniqueValues': false,
          'validators': [
            {
              'definition': {
                'allowDecimal': true
              },
              'name': 'number'
            },
            {
              'name': 'required'
            }
          ],
          'writable': true,
          'writeAccess': 'update',
          'writeOnCreate': true
        }
      ],
      'readAccess': 'read',
      'readable': true,
      'removable': false,
      'type': 'Document',
      'uniqueKey': 'c_key',
      'validators': [],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': true,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'label': 'Contacts',
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_contacts',
      'optional': false,
      'properties': [
        {
          'acl': [],
          'aclOverride': false,
          'array': false,
          'auditable': false,
          'canPull': true,
          'canPush': true,
          'creatable': false,
          'defaultValue': [],
          'dependencies': [],
          'history': false,
          'indexed': false,
          'label': 'Contact',
          'localization': {
            'acl': [],
            'aclOverride': false,
            'enabled': false,
            'fallback': true,
            'fixed': '',
            'readAccess': 'read',
            'strict': true,
            'valid': [],
            'writeAccess': 'update'
          },
          'lowercase': false,
          'maxItems': 100,
          'maxShift': false,
          'minItems': 0,
          'name': 'c_contact',
          'optional': false,
          'readAccess': 'read',
          'readable': true,
          'removable': false,
          'trim': false,
          'type': 'String',
          'unique': false,
          'uniqueValues': false,
          'uppercase': false,
          'validators': [
            {
              'name': 'required'
            },
            {
              'definition': {
                'min': 0,
                'max': 512
              },
              'name': 'string'
            }
          ],
          'writable': true,
          'writeAccess': 'update',
          'writeOnCreate': true
        },
        {
          'acl': [],
          'aclOverride': false,
          'array': false,
          'auditable': false,
          'autoGenerate': true,
          'canPull': true,
          'canPush': true,
          'creatable': false,
          'defaultValue': [],
          'dependencies': [],
          'history': false,
          'indexed': false,
          'label': 'Key',
          'maxItems': 100,
          'maxShift': false,
          'minItems': 0,
          'name': 'c_key',
          'optional': false,
          'readAccess': 'read',
          'readable': true,
          'removable': false,
          'type': 'UUID',
          'unique': false,
          'uniqueValues': false,
          'uuidVersion': 4,
          'validators': [
            {
              'name': 'uniqueInArray'
            }
          ],
          'writable': true,
          'writeAccess': 'update',
          'writeOnCreate': true
        },
        {
          'acl': [],
          'aclOverride': false,
          'array': false,
          'auditable': false,
          'canPull': true,
          'canPush': true,
          'creatable': false,
          'defaultValue': [],
          'dependencies': [],
          'history': false,
          'indexed': false,
          'label': 'Type',
          'maxItems': 100,
          'maxShift': false,
          'minItems': 0,
          'name': 'c_type',
          'optional': false,
          'readAccess': 'read',
          'readable': true,
          'removable': false,
          'type': 'Number',
          'unique': false,
          'uniqueValues': false,
          'validators': [
            {
              'definition': {
                'allowDecimal': true
              },
              'name': 'number'
            },
            {
              'name': 'required'
            }
          ],
          'writable': true,
          'writeAccess': 'update',
          'writeOnCreate': true
        }
      ],
      'readAccess': 'read',
      'readable': true,
      'removable': false,
      'type': 'Document',
      'uniqueKey': 'c_key',
      'validators': [],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': false,
      'auditable': false,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': false,
      'indexed': true,
      'label': 'Country',
      'localization': {
        'acl': [],
        'aclOverride': false,
        'enabled': false,
        'fallback': true,
        'fixed': '',
        'readAccess': 'read',
        'strict': true,
        'valid': [],
        'writeAccess': 'update'
      },
      'lowercase': false,
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_country',
      'optional': false,
      'readAccess': 'read',
      'readable': true,
      'removable': true,
      'trim': false,
      'type': 'String',
      'unique': false,
      'uniqueValues': false,
      'uppercase': false,
      'validators': [
        {
          'definition': {
            'min': 0,
            'max': 2
          },
          'name': 'string'
        }
      ],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': false,
      'auditable': false,
      'autoGenerate': true,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': false,
      'indexed': true,
      'label': 'Key',
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_key',
      'optional': false,
      'readAccess': 'read',
      'readable': true,
      'removable': false,
      'type': 'UUID',
      'unique': true,
      'uniqueValues': false,
      'uuidVersion': 4,
      'validators': [],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': false,
      'auditable': false,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': false,
      'indexed': true,
      'label': 'Name',
      'localization': {
        'acl': [],
        'aclOverride': false,
        'enabled': false,
        'fallback': true,
        'fixed': '',
        'readAccess': 'read',
        'strict': true,
        'valid': [],
        'writeAccess': 'update'
      },
      'lowercase': false,
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_name',
      'optional': false,
      'readAccess': 'read',
      'readable': true,
      'removable': false,
      'trim': false,
      'type': 'String',
      'unique': false,
      'uniqueValues': false,
      'uppercase': false,
      'validators': [
        {
          'definition': {
            'min': 0,
            'max': 512
          },
          'name': 'string'
        }
      ],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': false,
      'auditable': false,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': false,
      'indexed': true,
      'label': 'Number',
      'localization': {
        'acl': [],
        'aclOverride': false,
        'enabled': false,
        'fallback': true,
        'fixed': '',
        'readAccess': 'read',
        'strict': true,
        'valid': [],
        'writeAccess': 'update'
      },
      'lowercase': false,
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_number',
      'optional': false,
      'readAccess': 'read',
      'readable': true,
      'removable': false,
      'trim': false,
      'type': 'String',
      'unique': true,
      'uniqueValues': false,
      'uppercase': false,
      'validators': [
        {
          'definition': {
            'min': 0,
            'max': 512
          },
          'name': 'string'
        }
      ],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': false,
      'auditable': false,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': false,
      'indexed': false,
      'label': 'Principal Investigator Name',
      'localization': {
        'acl': [],
        'aclOverride': false,
        'enabled': false,
        'fallback': true,
        'fixed': '',
        'readAccess': 'read',
        'strict': true,
        'valid': [],
        'writeAccess': 'update'
      },
      'lowercase': false,
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_pi_name',
      'optional': false,
      'readAccess': 'read',
      'readable': true,
      'removable': true,
      'trim': false,
      'type': 'String',
      'unique': false,
      'uniqueValues': false,
      'uppercase': false,
      'validators': [
        {
          'definition': {
            'min': 0,
            'max': 512
          },
          'name': 'string'
        }
      ],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': true,
      'auditable': false,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': false,
      'indexed': false,
      'label': 'Supported Locales',
      'localization': {
        'acl': [],
        'aclOverride': false,
        'enabled': false,
        'fallback': true,
        'fixed': '',
        'readAccess': 'read',
        'strict': true,
        'valid': [],
        'writeAccess': 'update'
      },
      'lowercase': false,
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_supported_locales',
      'optional': false,
      'readAccess': 'min',
      'readable': true,
      'removable': false,
      'trim': false,
      'type': 'String',
      'unique': false,
      'uniqueValues': false,
      'uppercase': false,
      'validators': [
        {
          'definition': {
            'min': 0,
            'max': 25
          },
          'name': 'string'
        }
      ],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    },
    {
      'acl': [],
      'aclOverride': false,
      'array': false,
      'auditable': false,
      'canPull': true,
      'canPush': true,
      'creatable': false,
      'defaultValue': [],
      'dependencies': [],
      'history': true,
      'indexed': false,
      'label': 'Time Zone',
      'localization': {
        'acl': [],
        'aclOverride': false,
        'enabled': false,
        'fallback': true,
        'fixed': '',
        'readAccess': 'read',
        'strict': true,
        'valid': [],
        'writeAccess': 'update'
      },
      'lowercase': false,
      'maxItems': 100,
      'maxShift': false,
      'minItems': 0,
      'name': 'c_tz',
      'optional': false,
      'readAccess': 'read',
      'readable': true,
      'removable': true,
      'trim': false,
      'type': 'String',
      'unique': false,
      'uniqueValues': false,
      'uppercase': false,
      'validators': [
        {
          'name': 'timeZone'
        }
      ],
      'writable': true,
      'writeAccess': 'update',
      'writeOnCreate': true
    }
  ],
  'reporting': {
    'enabled': false
  },
  'uniqueKey': 'c_key',
  'validateOwner': true
}
