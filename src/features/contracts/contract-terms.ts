/**
 * Conditions générales du contrat de location (français + arabe).
 * Texte par défaut : les conditions du carnet de location habituel d'une agence marocaine (fournies par l'utilisateur),
 * avec le nom de l'agence en champ automatique et une version arabe. Il n'a PAS été validé par un juriste ni relu par
 * un arabophone : chaque agence peut le modifier entièrement dans « Mon contrat » et doit le faire relire.
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

/** Nom de l'agence dans les textes : champ automatique, remplacé par le nom réel au moment d'imprimer. */
const AGENCY = '{{agence_nom}}';

export function contractArticles(ctx: TermsContext): ContractArticle[] {
  const city = ctx.city.trim();
  return [
    {
      id: 'conditions',
      fr: {
        title: 'Conditions de location',
        body: `Tout locataire et conducteurs autorisés, désignés par ${AGENCY} au recto du présent contrat, sont tenus de fournir une carte d'identité ou un passeport en cours de validité, et un permis de conduire (1 an de validité minimum).
La location est consentie pour une durée ferme précisée au recto du présent contrat.
La journée de location correspond à 24 heures, à partir de l'heure de la prise en charge de la voiture. Toute journée commencée est due.
${AGENCY} se réserve le plein droit de mettre fin à la location et de récupérer le véhicule par tout moyen, sans justification ni indemnité, au cas où le locataire n'aurait pas respecté l'une des obligations du présent contrat lui revenant, ou si intervient un problème de règlement : rejet du chèque, refus de la carte de crédit, dépassement du nombre de jours de location autorisé par ce contrat.
En tout état de cause, le client doit avoir réglé l'intégralité de la période de location avant la prise du véhicule.
Dès remise du véhicule, le locataire et les conducteurs agréés deviennent entièrement responsables envers ${AGENCY} de l'exécution intégrale des présentes conditions.`,
      },
      ar: {
        title: 'شروط الكراء',
        body: `على كل مكتر وسائق مرخص له، محدد من طرف ${AGENCY} في الوجه الأول من هذا العقد، الإدلاء ببطاقة التعريف أو جواز السفر ساري المفعول، وبرخصة سياقة (مدة صلاحيتها سنة واحدة على الأقل).
يُبرم الكراء لمدة ثابتة محددة في الوجه الأول من هذا العقد.
يوم الكراء يساوي 24 ساعة ابتداء من ساعة تسلم السيارة، وكل يوم بدأ يُستحق أداؤه.
تحتفظ ${AGENCY} بكامل الحق في إنهاء الكراء واسترجاع السيارة بأي وسيلة، دون مبرر ولا تعويض، إذا لم يحترم المكتري أحد التزاماته بموجب هذا العقد، أو إذا حدثت مشكلة في الأداء: رفض الشيك، رفض البطاقة البنكية، تجاوز عدد أيام الكراء المسموح بها في هذا العقد.
وفي جميع الأحوال، يجب على الزبون أداء كامل مدة الكراء قبل تسلم السيارة.
بمجرد تسلم السيارة، يصبح المكتري والسائقون المعتمدون مسؤولين كليا تجاه ${AGENCY} عن التنفيذ الكامل لهذه الشروط.`,
      },
    },
    {
      id: 'mecanique',
      fr: {
        title: 'Mécanique',
        body: `L'usure mécanique normale est à la charge de ${AGENCY}. Toutes les réparations provenant d'une usure anormale, d'une négligence de la part du client ou d'un accident sont à la charge du client. Les pièces défectueuses remplacées devront être présentées avec la facture régulièrement acquittée, mentionnant le montant intégral de la réparation.`,
      },
      ar: {
        title: 'الميكانيك',
        body: `الاستهلاك الميكانيكي العادي على عاتق ${AGENCY}. أما جميع الإصلاحات الناتجة عن استهلاك غير عادي أو إهمال من الزبون أو حادثة فهي على عاتق الزبون. ويجب الإدلاء بالقطع المعيبة المستبدلة مع الفاتورة المؤداة بصفة قانونية والمبينة للمبلغ الكامل للإصلاح.`,
      },
    },
    {
      id: 'pneumatiques',
      fr: {
        title: 'Pneumatiques',
        body: `Le locataire déclare que les cinq pneumatiques de la voiture sont en bon état, sans coupures, et que leur usure est normale. En cas de détérioration de l'un d'entre eux pour une cause autre que l'usure normale, le locataire s'engage à le remplacer immédiatement par un pneu de même dimension et de la même marque que ceux qui équipaient le véhicule loué.`,
      },
      ar: {
        title: 'العجلات',
        body: `يصرح المكتري بأن العجلات الخمس للسيارة في حالة جيدة وبدون تمزقات وأن استهلاكها عادي. وفي حالة تلف إحداها لسبب غير الاستهلاك العادي، يلتزم المكتري باستبدالها فورا بعجلة من نفس القياس ونفس العلامة التي كانت تجهز السيارة المكراة.`,
      },
    },
    {
      id: 'etat',
      fr: {
        title: 'État du véhicule',
        body: `Le locataire ne pourra en aucun cas réclamer à ${AGENCY} des dommages et intérêts, soit pour retard de remise de la voiture ou annulation de la location, soit pour réparation nécessaire due à l'usure normale et effectuée au cours de la location.
${AGENCY} dégage toute responsabilité pour les utilisations illégales des voitures par les locataires.
Garanties optionnelles et assurances complémentaires : le locataire est garanti suivant les conditions générales des polices d'assurance contractées par ${AGENCY}, à savoir : les accidents causés aux tiers, selon la franchise, et la responsabilité civile.
Pour l'incendie et le vol des accessoires, vêtements et de tous les objets à l'intérieur de la voiture et du coffre, le conducteur reste son propre assureur.`,
      },
      ar: {
        title: 'حالة السيارة',
        body: `لا يحق للمكتري بأي حال من الأحوال أن يطالب ${AGENCY} بتعويضات، سواء بسبب التأخر في تسليم السيارة أو إلغاء الكراء، أو بسبب إصلاح ضروري ناتج عن الاستهلاك العادي وأُنجز أثناء مدة الكراء.
تخلي ${AGENCY} مسؤوليتها عن الاستعمالات غير القانونية للسيارات من طرف المكترين.
الضمانات الاختيارية والتأمينات التكميلية: يستفيد المكتري من الضمان وفق الشروط العامة لعقود التأمين التي اكتتبتها ${AGENCY}، وهي: الحوادث التي تلحق الغير، حسب التحمل، والمسؤولية المدنية.
وفي حالة الحريق وسرقة الملحقات والملابس وجميع الأشياء الموجودة داخل السيارة وفي الصندوق، يبقى السائق مؤمنا لنفسه.`,
      },
    },
    {
      id: 'accident',
      fr: {
        title: 'Accident et constat',
        body: `Le client doit rendre le constat de police ou de gendarmerie dûment rempli ; à défaut, il prend en charge toutes les sommes pour la réparation du véhicule, dans la limite de la franchise.
Le client ne devra en aucun cas discuter de la responsabilité de l'accident, ni transiger avec les tiers, ni faire acte pouvant gêner ou engager la compagnie d'assurance dans le règlement du sinistre.`,
      },
      ar: {
        title: 'الحادثة والمحضر',
        body: `يجب على الزبون تسليم محضر الشرطة أو الدرك مملوءا بصفة قانونية؛ وإلا تحمل جميع المبالغ اللازمة لإصلاح السيارة، في حدود التحمل.
ولا يجوز للزبون بأي حال من الأحوال أن يناقش مسؤولية الحادثة، ولا أن يتصالح مع الغير، ولا أن يقوم بأي تصرف من شأنه عرقلة شركة التأمين أو إلزامها في تسوية الحادثة.`,
      },
    },
    {
      id: 'parties-inferieures',
      fr: {
        title: 'Parties inférieures, intérieur et bris de glace',
        body: `Le locataire demeure responsable des dégâts occasionnés aux parties inférieures du véhicule, pour quelque cause que ce soit, même s'il a souscrit au rachat de la franchise (CDW). Les parties inférieures s'entendent des organes situés sous le châssis :
- les dégradations à l'intérieur du véhicule ;
- les dommages causés aux pneumatiques et aux jantes ;
- radiateur, cardan, etc., qui ne sont pas couverts par l'assureur.
Le locataire est également responsable des dégâts occasionnés au pare-brise, ou de tout autre bris de glace ou de feux de signalisation.`,
      },
      ar: {
        title: 'الأجزاء السفلية والداخل وكسر الزجاج',
        body: `يبقى المكتري مسؤولا عن الأضرار التي تلحق الأجزاء السفلية للسيارة، مهما كان سببها، حتى وإن اكتتب في إعادة شراء التحمل (CDW). ويقصد بالأجزاء السفلية الأعضاء الموجودة تحت الهيكل:
- التلف الذي يلحق داخل السيارة؛
- الأضرار التي تلحق العجلات والجانطات؛
- المبرد والكاردان وغيرها مما لا يغطيه المؤمن.
كما يكون المكتري مسؤولا عن الأضرار التي تلحق الزجاج الأمامي، أو أي كسر آخر للزجاج أو لأضواء الإشارة.`,
      },
    },
    {
      id: 'decheance',
      fr: {
        title: 'Déchéance des garanties',
        body: `Enfin, le locataire est déchu des garanties vol, incendie et dommages causés au véhicule si tout conducteur est en état d'ivresse, sous l'emprise d'un état alcoolique, sous l'effet de drogues ou de toute autre substance modifiant les réflexes indispensables à la conduite.`,
      },
      ar: {
        title: 'سقوط الضمانات',
        body: `وأخيرا، يسقط حق المكتري في ضمانات السرقة والحريق والأضرار اللاحقة بالسيارة إذا كان أي سائق في حالة سكر، أو تحت تأثير الكحول، أو المخدرات، أو أي مادة أخرى تؤثر على ردود الفعل الضرورية للسياقة.`,
      },
    },
    {
      id: 'caution',
      fr: {
        title: 'Caution et prolongation',
        body: `Le locataire paiera d'avance ; la caution déposée par lui ne pourra en aucun cas servir à une prolongation de la location, ni tenir lieu de provision correspondante, sous peine de l'exposer à des poursuites judiciaires pour détournement de véhicule et abus de confiance.
Cependant, le loueur se réserve le droit de refuser la prolongation de la location, avec obligation pour le locataire de restituer immédiatement le véhicule.`,
      },
      ar: {
        title: 'الضمانة وتمديد الكراء',
        body: `يؤدي المكتري المبلغ مسبقا؛ ولا يمكن بأي حال من الأحوال أن تُستعمل الضمانة التي أودعها لتمديد الكراء، ولا أن تعوض المؤونة المقابلة، وإلا تعرض لمتابعات قضائية من أجل اختلاس السيارة وخيانة الأمانة.
غير أن المكري يحتفظ بالحق في رفض تمديد الكراء، مع التزام المكتري بإرجاع السيارة فورا.`,
      },
    },
    {
      id: 'assurance-vol',
      fr: {
        title: 'Assurance vol',
        body: `Le locataire est assuré contre le vol, mais cette garantie ne peut jouer que sous réserve de la restitution des clés, de la carte grise du véhicule et des autres documents nécessaires à la circulation, ainsi que d'une déclaration de vol dûment remplie par la police ou la gendarmerie. La franchise reste à la charge du client.`,
      },
      ar: {
        title: 'التأمين ضد السرقة',
        body: `المكتري مؤمن ضد السرقة، غير أن هذا الضمان لا يسري إلا بشرط إرجاع المفاتيح والبطاقة الرمادية للسيارة والوثائق الأخرى اللازمة للسير، وكذا تصريح بالسرقة مملوء بصفة قانونية لدى الشرطة أو الدرك. ويبقى التحمل على عاتق الزبون.`,
      },
    },
    {
      id: 'restitution',
      fr: {
        title: 'Restitution du véhicule',
        body: `Le véhicule doit être restitué pendant les heures d'ouverture de l'agence de location, à la date, l'heure et l'endroit prévus au contrat. Il doit également être restitué avec les documents, équipements et accessoires nécessaires à la circulation.
Si le locataire ne peut restituer les documents de circulation ou les clés du véhicule, il demeure redevable à ${AGENCY} des jours d'immobilisation, et ce jusqu'à production par lui d'une attestation de perte, ainsi que des frais de délivrance du duplicata.`,
      },
      ar: {
        title: 'إرجاع السيارة',
        body: `يجب إرجاع السيارة خلال ساعات عمل وكالة الكراء، في التاريخ والساعة والمكان المحددين في العقد. كما يجب إرجاعها مع الوثائق والتجهيزات والملحقات اللازمة للسير.
وإذا تعذر على المكتري إرجاع وثائق السير أو مفاتيح السيارة، يبقى مدينا لـ ${AGENCY} بأيام التوقف، وذلك إلى حين الإدلاء بشهادة الضياع، إضافة إلى مصاريف استخراج النسخة الثانية.`,
      },
    },
    {
      id: 'amendes',
      fr: {
        title: 'Amendes et contraventions',
        body: `Le locataire et/ou les conducteurs agréés sont responsables des amendes, contraventions et procès-verbaux établis à leur encontre. Il s'engage à rembourser le montant à ${AGENCY} si celle-ci était amenée à en faire l'avance.`,
      },
      ar: {
        title: 'الغرامات والمخالفات',
        body: `المكتري و/أو السائقون المعتمدون مسؤولون عن الغرامات والمخالفات والمحاضر المحررة في حقهم. ويلتزم برد مبلغها إلى ${AGENCY} إذا اضطرت إلى أدائها مسبقا.`,
      },
    },
    {
      id: 'juridiction',
      fr: {
        title: 'Juridiction',
        body: `En cas de litige qui pourrait naître de l'exécution du présent contrat, les tribunaux ${city ? `de ${city}` : "du siège de l'agence"} seront seuls compétents.`,
      },
      ar: {
        title: 'الاختصاص القضائي',
        body: `في حالة نزاع قد ينشأ عن تنفيذ هذا العقد، تكون المحاكم ${city ? `بـ ${city}` : 'بمقر الوكالة'} وحدها المختصة.`,
      },
    },
  ];
}

export const CONTRACT_ACCEPTANCE = {
  fr: 'Lu et approuvé. Le Locataire reconnaît avoir pris connaissance des conditions ci-dessus et les accepter.',
  ar: 'قرأت ووافقت. يقر المكتري بأنه اطلع على الشروط أعلاه وقبلها.',
} as const;
