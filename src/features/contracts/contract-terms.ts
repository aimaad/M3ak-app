/**
 * Conditions générales du contrat de location (français + arabe).
 * Modèle standard marocain rédigé pour M3ak : il n'a PAS été validé par un juriste. Chaque agence doit le faire
 * relire (et compléter par ses « conditions particulières ») avant un usage commercial.
 */
export type TermsContext = {
  /** Montant de la caution déjà formaté, ex. « 2 000 MAD ». */
  caution: string;
  /** Ville dont les tribunaux sont compétents ; chaîne vide si inconnue. */
  city: string;
};

export type ContractArticle = {
  id: string;
  fr: { title: string; body: string };
  ar: { title: string; body: string };
};

export function contractArticles(ctx: TermsContext): ContractArticle[] {
  const city = ctx.city.trim();
  return [
    {
      id: 'objet',
      fr: {
        title: 'Objet du contrat',
        body: "L'Agence loue au Locataire, sans chauffeur, le véhicule désigné au présent contrat, avec ses accessoires, pour la durée indiquée. Le véhicule reste la propriété exclusive de l'Agence.",
      },
      ar: {
        title: 'موضوع العقد',
        body: 'تكري الوكالة للمكتري، بدون سائق، السيارة المحددة في هذا العقد مع ملحقاتها، طيلة المدة المبينة أعلاه. وتبقى السيارة ملكا خالصا للوكالة.',
      },
    },
    {
      id: 'duree',
      fr: {
        title: 'Durée et restitution',
        body: "La location court de la date et heure de départ à la date et heure de retour prévues. Le Locataire restitue le véhicule, ses clés et ses documents au lieu convenu, à l'heure prévue. Tout retard non autorisé par l'Agence peut donner lieu à une facturation supplémentaire. Toute prolongation doit être demandée et acceptée avant l'échéance.",
      },
      ar: {
        title: 'المدة والإرجاع',
        body: 'يبدأ الكراء من تاريخ وساعة الانطلاق وينتهي في تاريخ وساعة الإرجاع المتفق عليهما. يلتزم المكتري بإرجاع السيارة ومفاتيحها ووثائقها في المكان والوقت المتفق عليهما. كل تأخير غير مرخص من الوكالة قد يترتب عنه أداء مبلغ إضافي. ويجب طلب كل تمديد وقبوله قبل انتهاء المدة.',
      },
    },
    {
      id: 'prix',
      fr: {
        title: 'Prix et paiement',
        body: "Le prix total de la location est celui indiqué au contrat. Il est payable selon les modalités convenues avec l'Agence. Les frais supplémentaires (retard, carburant manquant, dommages, amendes) sont dus en plus et peuvent être déduits de la caution.",
      },
      ar: {
        title: 'الثمن والأداء',
        body: 'ثمن الكراء الإجمالي هو المبين في العقد، ويؤدى حسب الكيفيات المتفق عليها مع الوكالة. أما المصاريف الإضافية (التأخير، الوقود الناقص، الأضرار، الغرامات) فهي مستحقة زيادة على ذلك ويمكن خصمها من الضمانة.',
      },
    },
    {
      id: 'caution',
      fr: {
        title: 'Dépôt de garantie (caution)',
        body: `Le Locataire verse une caution de ${ctx.caution}. Elle garantit l'exécution du contrat. Elle est restituée à la fin de la location après vérification du véhicule, déduction faite, le cas échéant, des dommages constatés, du carburant manquant, des frais de retard, des amendes et de toute somme due à l'Agence. Si la retenue dépasse la caution, le Locataire règle la différence.`,
      },
      ar: {
        title: 'الضمانة',
        body: `يدفع المكتري ضمانة قدرها ${ctx.caution} لضمان تنفيذ العقد. وتُرد له عند نهاية الكراء بعد فحص السيارة، مع خصم الأضرار المعاينة والوقود الناقص ومصاريف التأخير والغرامات وكل مبلغ مستحق للوكالة. وإذا فاق المبلغ المخصوم قيمة الضمانة، يؤدي المكتري الفرق.`,
      },
    },
    {
      id: 'conducteurs',
      fr: {
        title: 'Conducteurs autorisés',
        body: "Seuls le Locataire et les conducteurs désignés au contrat, titulaires d'un permis de conduire valide, sont autorisés à conduire. Le Locataire est responsable de la conduite de toute personne à qui il confie le véhicule en dehors de cette liste.",
      },
      ar: {
        title: 'السائقون المرخص لهم',
        body: 'لا يحق بسياقة السيارة إلا المكتري والسائقون المحددون في العقد، شريطة أن يكونوا حاملين لرخصة سياقة سارية. ويتحمل المكتري مسؤولية كل شخص يسلمه السيارة خارج هذه اللائحة.',
      },
    },
    {
      id: 'usage',
      fr: {
        title: 'Usage du véhicule',
        body: "Le véhicule doit être utilisé en bon père de famille, conformément au code de la route. Il est interdit : de le sous-louer ou le prêter hors conducteurs désignés ; de l'utiliser pour des courses, compétitions, apprentissage de la conduite, remorquage ou transport de marchandises dangereuses ou illicites ; de conduire sous l'emprise de l'alcool ou de stupéfiants ; de le sortir du territoire marocain sans accord écrit de l'Agence.",
      },
      ar: {
        title: 'استعمال السيارة',
        body: 'يجب استعمال السيارة استعمال رب الأسرة الحريص ووفق مدونة السير. ويمنع: كراؤها من الباطن أو إعارتها لغير السائقين المحددين؛ واستعمالها في السباقات أو تعليم السياقة أو الجر أو نقل مواد خطيرة أو ممنوعة؛ والسياقة تحت تأثير الكحول أو المخدرات؛ وإخراجها من التراب المغربي دون إذن كتابي من الوكالة.',
      },
    },
    {
      id: 'etat',
      fr: {
        title: 'État du véhicule et accessoires',
        body: "Le véhicule est remis en bon état de marche, avec les accessoires listés à l'état des lieux de départ. Le Locataire le restitue dans le même état, hors usure normale. Les accessoires manquants ou détériorés sont à sa charge. Le Locataire vérifie régulièrement les niveaux et la pression des pneus.",
      },
      ar: {
        title: 'حالة السيارة وملحقاتها',
        body: 'تُسلم السيارة في حالة جيدة للسير مع الملحقات المسجلة في معاينة الانطلاق. ويلتزم المكتري بإرجاعها في الحالة نفسها باستثناء الاستهلاك العادي. والملحقات المفقودة أو المتلفة على نفقته. ويتعهد بمراقبة مستويات السوائل وضغط العجلات بانتظام.',
      },
    },
    {
      id: 'carburant',
      fr: {
        title: 'Carburant et kilométrage',
        body: "Le véhicule est restitué avec le même niveau de carburant qu'au départ ; tout manque est facturé. Le kilométrage autorisé et les éventuels suppléments sont précisés dans les conditions particulières, le cas échéant. Le kilométrage relevé au départ et au retour fait foi.",
      },
      ar: {
        title: 'الوقود والمسافة المقطوعة',
        body: 'تُرجع السيارة بنفس مستوى الوقود الذي سُلمت به، وكل نقص يُحتسب على المكتري. تُحدد المسافة المسموح بها والمصاريف الإضافية المحتملة في الشروط الخاصة إن وجدت. ويُعتد بعداد الكيلومترات المسجل عند الانطلاق والإرجاع.',
      },
    },
    {
      id: 'assurance',
      fr: {
        title: 'Assurance et responsabilité',
        body: "Le véhicule bénéficie de l'assurance obligatoire de responsabilité civile souscrite par l'Agence. Les garanties, franchises et exclusions sont celles du contrat d'assurance de l'Agence, consultable sur demande. Le Locataire reste responsable des dommages non couverts, notamment en cas de faute lourde, de non-respect des conditions du contrat, de conduite par une personne non autorisée ou sous l'emprise de l'alcool ou de stupéfiants, ainsi que des dommages aux pneus, vitres, intérieur et dessous de caisse sauf stipulation contraire.",
      },
      ar: {
        title: 'التأمين والمسؤولية',
        body: 'تستفيد السيارة من التأمين الإجباري عن المسؤولية المدنية الذي اكتتبته الوكالة. وتخضع الضمانات والتحملات والاستثناءات لعقد تأمين الوكالة الذي يمكن الاطلاع عليه عند الطلب. ويبقى المكتري مسؤولا عن الأضرار غير المغطاة، خاصة في حالة الخطأ الجسيم أو مخالفة شروط العقد أو السياقة من طرف شخص غير مرخص له أو تحت تأثير الكحول أو المخدرات، وكذا عن أضرار العجلات والزجاج والداخل وأسفل السيارة ما لم ينص على خلاف ذلك.',
      },
    },
    {
      id: 'accident',
      fr: {
        title: 'Accident, vol et panne',
        body: "En cas d'accident, de vol ou de panne, le Locataire prévient immédiatement l'Agence, établit un constat amiable signé des parties et, en cas de vol ou de dégât volontaire, dépose plainte auprès des autorités. Il n'engage aucune réparation sans l'accord de l'Agence et ne reconnaît aucune responsabilité auprès des tiers.",
      },
      ar: {
        title: 'الحادثة والسرقة والعطب',
        body: 'في حالة حادثة أو سرقة أو عطب، يخبر المكتري الوكالة فورا، ويحرر محضرا ودياً موقعا من الأطراف، ويقدم شكاية لدى السلطات في حالة السرقة أو التخريب. ولا يقوم بأي إصلاح دون موافقة الوكالة ولا يعترف بأي مسؤولية أمام الغير.',
      },
    },
    {
      id: 'infractions',
      fr: {
        title: 'Infractions et amendes',
        body: "Le Locataire supporte les amendes, contraventions, frais de fourrière et péages liés à la période de location. L'Agence peut communiquer son identité aux autorités et déduire ces sommes de la caution, même après la restitution du véhicule.",
      },
      ar: {
        title: 'المخالفات والغرامات',
        body: 'يتحمل المكتري الغرامات والمخالفات ومصاريف الحجز والأداءات المتعلقة بمدة الكراء. ويحق للوكالة الإدلاء بهويته للسلطات وخصم هذه المبالغ من الضمانة، حتى بعد إرجاع السيارة.',
      },
    },
    {
      id: 'resiliation',
      fr: {
        title: 'Résiliation',
        body: "En cas de manquement grave du Locataire (usage interdit, non-paiement, fausse déclaration, conducteur non autorisé), l'Agence peut résilier le contrat sans préavis et reprendre le véhicule là où il se trouve, aux frais du Locataire.",
      },
      ar: {
        title: 'الفسخ',
        body: 'في حالة إخلال جسيم من المكتري (استعمال ممنوع، عدم الأداء، تصريح كاذب، سائق غير مرخص له)، يحق للوكالة فسخ العقد دون إنذار مسبق واسترجاع السيارة من مكان وجودها على نفقة المكتري.',
      },
    },
    {
      id: 'donnees',
      fr: {
        title: 'Données personnelles',
        body: "Les données du Locataire (identité, permis, contact) sont traitées par l'Agence pour la gestion du contrat, conformément à la loi n° 09-08 relative à la protection des personnes physiques à l'égard du traitement des données à caractère personnel. Le Locataire peut exercer ses droits d'accès, de rectification et d'opposition auprès de l'Agence.",
      },
      ar: {
        title: 'المعطيات الشخصية',
        body: 'تعالج الوكالة معطيات المكتري (الهوية، الرخصة، بيانات الاتصال) لتدبير هذا العقد طبقا للقانون رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي. وللمكتري الحق في الولوج والتصحيح والتعرض لدى الوكالة.',
      },
    },
    {
      id: 'litiges',
      fr: {
        title: 'Droit applicable et litiges',
        body: `Le présent contrat est soumis au droit marocain. À défaut d'accord amiable, tout litige relève des tribunaux compétents${city ? ` de ${city}` : ' du siège de l’Agence'}.`,
      },
      ar: {
        title: 'القانون المطبق والنزاعات',
        body: `يخضع هذا العقد للقانون المغربي. وعند تعذر الحل الودي، يؤول الاختصاص في كل نزاع إلى المحاكم المختصة${city ? ` بـ ${city}` : ' بمقر الوكالة'}.`,
      },
    },
  ];
}

export const CONTRACT_ACCEPTANCE = {
  fr: 'Lu et approuvé. Le Locataire reconnaît avoir pris connaissance des conditions ci-dessus et les accepter.',
  ar: 'قرأت ووافقت. يقر المكتري بأنه اطلع على الشروط أعلاه وقبلها.',
} as const;
