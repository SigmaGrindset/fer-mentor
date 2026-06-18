/**
 * Realistic Croatian sample data for the mock API layer.
 * ~8 mentori across FER zavodi, with theses (repo + schedule sources).
 *
 * NOTE: all names/data here are fictional and used only for the demo.
 */
import type { ThesisOut } from './types'

export interface MockThesis extends ThesisOut {
  /** denormalized for mock keyword search */
  abstract?: string
}

export interface MockMentor {
  id: number
  full_name: string
  zavod_code: string
  scientific_fields: string[]
  /** current-year topics this mentor leads (source: schedule) */
  current_topics: string[]
  theses: MockThesis[]
}

export const MOCK_MENTORS: MockMentor[] = [
  {
    id: 1,
    full_name: 'Ivana Kovačević',
    zavod_code: 'ZEMRIS',
    scientific_fields: ['računalni vid', 'duboko učenje', 'obrada slike'],
    current_topics: [
      'Segmentacija medicinskih slika dubokim učenjem',
      'Detekcija objekata u stvarnom vremenu na ugradbenim uređajima',
    ],
    theses: [
      {
        id: 101,
        title: 'Detekcija i klasifikacija prometnih znakova konvolucijskim neuronskim mrežama',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'računalni vid',
        keywords: ['računalni vid', 'CNN', 'klasifikacija slika', 'autonomna vožnja'],
        source: 'repo',
        abstract:
          'Rad istražuje primjenu konvolucijskih neuronskih mreža za detekciju prometnih znakova u stvarnom vremenu.',
      },
      {
        id: 102,
        title: 'Segmentacija tumora na MR snimkama mozga dubokim učenjem',
        year: 2022,
        thesis_type: 'diplomski',
        scientific_field: 'obrada slike',
        keywords: ['segmentacija', 'duboko učenje', 'medicinska slika', 'U-Net'],
        source: 'repo',
        abstract: 'Model temeljen na U-Net arhitekturi za semantičku segmentaciju tumora.',
      },
      {
        id: 103,
        title: 'Praćenje objekata u videu pomoću dubokih neuronskih mreža',
        year: 2024,
        thesis_type: 'završni',
        scientific_field: 'računalni vid',
        keywords: ['praćenje objekata', 'video', 'računalni vid'],
        source: 'repo',
        abstract: 'Usporedba metoda za praćenje više objekata u videosekvencama.',
      },
    ],
  },
  {
    id: 2,
    full_name: 'Marko Horvat',
    zavod_code: 'ZEMRIS',
    scientific_fields: ['obrada prirodnog jezika', 'strojno učenje', 'veliki jezični modeli'],
    current_topics: [
      'Sustav za odgovaranje na pitanja nad hrvatskim tekstom',
      'Sažimanje pravnih dokumenata velikim jezičnim modelima',
    ],
    theses: [
      {
        id: 201,
        title: 'Analiza sentimenta korisničkih recenzija na hrvatskom jeziku',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'obrada prirodnog jezika',
        keywords: ['obrada prirodnog jezika', 'analiza sentimenta', 'transformeri', 'BERT'],
        source: 'repo',
        abstract: 'Fino ugađanje BERT modela za klasifikaciju sentimenta na hrvatskom korpusu.',
      },
      {
        id: 202,
        title: 'Sustav za prepoznavanje imenovanih entiteta u novinskim člancima',
        year: 2022,
        thesis_type: 'diplomski',
        scientific_field: 'obrada prirodnog jezika',
        keywords: ['NER', 'obrada prirodnog jezika', 'strojno učenje'],
        source: 'repo',
        abstract: 'Prepoznavanje osoba, organizacija i lokacija u hrvatskim tekstovima.',
      },
      {
        id: 203,
        title: 'Generiranje sažetaka znanstvenih radova velikim jezičnim modelima',
        year: 2024,
        thesis_type: 'diplomski',
        scientific_field: 'obrada prirodnog jezika',
        keywords: ['veliki jezični modeli', 'sažimanje teksta', 'LLM'],
        source: 'repo',
        abstract: 'Apstraktivno sažimanje znanstvenih radova pomoću jezičnih modela.',
      },
    ],
  },
  {
    id: 3,
    full_name: 'Ana Novak',
    zavod_code: 'ZPR',
    scientific_fields: ['web aplikacije', 'programsko inženjerstvo', 'oblačno računarstvo'],
    current_topics: [
      'Razvoj progresivne web-aplikacije za upravljanje studentskim projektima',
      'Mikroservisna arhitektura za sustav e-učenja',
    ],
    theses: [
      {
        id: 301,
        title: 'Razvoj web-aplikacije za upravljanje sportskim natjecanjima',
        year: 2023,
        thesis_type: 'završni',
        scientific_field: 'web aplikacije',
        keywords: ['web aplikacije', 'React', 'REST API', 'programsko inženjerstvo'],
        source: 'repo',
        abstract: 'Potpuna web-aplikacija s React sučeljem i REST poslužiteljem.',
      },
      {
        id: 302,
        title: 'Mikroservisna arhitektura za platformu dostave hrane',
        year: 2024,
        thesis_type: 'diplomski',
        scientific_field: 'programsko inženjerstvo',
        keywords: ['mikroservisi', 'oblačno računarstvo', 'Docker', 'Kubernetes'],
        source: 'repo',
        abstract: 'Dizajn i implementacija skalabilne mikroservisne platforme.',
      },
      {
        id: 303,
        title: 'Razvoj web-aplikacije za rezervaciju termina u zdravstvu',
        year: 2022,
        thesis_type: 'završni',
        scientific_field: 'web aplikacije',
        keywords: ['web aplikacije', 'baze podataka', 'Node.js'],
        source: 'repo',
        abstract: 'Sustav za rezervaciju liječničkih termina s podsjetnicima.',
      },
    ],
  },
  {
    id: 4,
    full_name: 'Petar Babić',
    zavod_code: 'ZARI',
    scientific_fields: ['računalne mreže', 'kibernetička sigurnost', 'distribuirani sustavi'],
    current_topics: [
      'Detekcija mrežnih napada strojnim učenjem',
      'Sigurnost Internet of Things uređaja',
    ],
    theses: [
      {
        id: 401,
        title: 'Sustav za detekciju upada u računalne mreže temeljen na strojnom učenju',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'kibernetička sigurnost',
        keywords: ['sigurnost', 'računalne mreže', 'detekcija upada', 'strojno učenje'],
        source: 'repo',
        abstract: 'IDS sustav koji klasificira mrežni promet i otkriva anomalije.',
      },
      {
        id: 402,
        title: 'Analiza ranjivosti pametnih kućnih uređaja',
        year: 2022,
        thesis_type: 'diplomski',
        scientific_field: 'kibernetička sigurnost',
        keywords: ['IoT', 'sigurnost', 'ranjivosti'],
        source: 'repo',
        abstract: 'Penetracijsko testiranje IoT uređaja u kućnoj mreži.',
      },
      {
        id: 403,
        title: 'Implementacija sustava za enkripciju komunikacije u stvarnom vremenu',
        year: 2021,
        thesis_type: 'završni',
        scientific_field: 'računalne mreže',
        keywords: ['kriptografija', 'mreže', 'sigurnost'],
        source: 'repo',
        abstract: 'Kraj-do-kraja enkripcija za sustav za razmjenu poruka.',
      },
    ],
  },
  {
    id: 5,
    full_name: 'Lucija Marić',
    zavod_code: 'ZESOI',
    scientific_fields: ['ugradbeni sustavi', 'robotika', 'mikrokontroleri'],
    current_topics: [
      'Upravljanje autonomnim mobilnim robotom',
      'Sustav za nadzor temeljen na ugradbenim senzorima',
    ],
    theses: [
      {
        id: 501,
        title: 'Razvoj autonomnog mobilnog robota za zatvorene prostore',
        year: 2024,
        thesis_type: 'diplomski',
        scientific_field: 'robotika',
        keywords: ['robotika', 'ugradbeni sustavi', 'navigacija', 'senzori'],
        source: 'repo',
        abstract: 'Robot koji autonomno navigira pomoću LIDAR senzora i SLAM algoritma.',
      },
      {
        id: 502,
        title: 'Sustav za prikupljanje podataka senzorima na mikrokontroleru',
        year: 2022,
        thesis_type: 'završni',
        scientific_field: 'ugradbeni sustavi',
        keywords: ['ugradbeni sustavi', 'mikrokontroleri', 'senzori', 'IoT'],
        source: 'repo',
        abstract: 'Ugradbeni sustav za mjerenje kvalitete zraka u stvarnom vremenu.',
      },
      {
        id: 503,
        title: 'Upravljanje robotskom rukom pomoću računalnog vida',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'robotika',
        keywords: ['robotika', 'računalni vid', 'upravljanje'],
        source: 'repo',
        abstract: 'Hvatanje objekata robotskom rukom uz prepoznavanje kamerom.',
      },
    ],
  },
  {
    id: 6,
    full_name: 'Tomislav Jurić',
    zavod_code: 'ZTEL',
    scientific_fields: ['telekomunikacije', 'obrada signala', 'bežične mreže'],
    current_topics: [
      'Optimizacija 5G mreža strojnim učenjem',
      'Obrada zvučnih signala dubokim učenjem',
    ],
    theses: [
      {
        id: 601,
        title: 'Optimizacija raspodjele resursa u 5G mobilnim mrežama',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'telekomunikacije',
        keywords: ['5G', 'telekomunikacije', 'optimizacija', 'bežične mreže'],
        source: 'repo',
        abstract: 'Algoritam za dinamičku raspodjelu spektra u 5G mrežama.',
      },
      {
        id: 602,
        title: 'Uklanjanje šuma iz govornih signala dubokim učenjem',
        year: 2024,
        thesis_type: 'diplomski',
        scientific_field: 'obrada signala',
        keywords: ['obrada signala', 'duboko učenje', 'govor', 'šum'],
        source: 'repo',
        abstract: 'Neuronska mreža za poboljšanje kvalitete govora u bučnom okruženju.',
      },
      {
        id: 603,
        title: 'Analiza performansi Wi-Fi mreža u gustim okruženjima',
        year: 2021,
        thesis_type: 'završni',
        scientific_field: 'bežične mreže',
        keywords: ['Wi-Fi', 'bežične mreže', 'mjerenja'],
        source: 'repo',
        abstract: 'Eksperimentalna analiza propusnosti Wi-Fi mreža.',
      },
    ],
  },
  {
    id: 7,
    full_name: 'Marija Vuković',
    zavod_code: 'ZPR',
    scientific_fields: ['baze podataka', 'analiza podataka', 'strojno učenje'],
    current_topics: [
      'Sustav za preporuke temeljen na velikim podatcima',
      'Vizualizacija i analiza velikih skupova podataka',
    ],
    theses: [
      {
        id: 701,
        title: 'Sustav za preporuke filmova temeljen na kolaborativnom filtriranju',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'analiza podataka',
        keywords: ['preporuke', 'strojno učenje', 'analiza podataka', 'kolaborativno filtriranje'],
        source: 'repo',
        abstract: 'Sustav preporuka koji kombinira sadržajno i kolaborativno filtriranje.',
      },
      {
        id: 702,
        title: 'Skladište podataka i analitička obrada poslovnih podataka',
        year: 2022,
        thesis_type: 'diplomski',
        scientific_field: 'baze podataka',
        keywords: ['baze podataka', 'skladište podataka', 'ETL', 'analitika'],
        source: 'repo',
        abstract: 'Dizajn skladišta podataka i ETL procesa za poslovnu analitiku.',
      },
      {
        id: 703,
        title: 'Predviđanje potražnje primjenom metoda strojnog učenja',
        year: 2024,
        thesis_type: 'diplomski',
        scientific_field: 'strojno učenje',
        keywords: ['strojno učenje', 'predviđanje', 'vremenske serije'],
        source: 'repo',
        abstract: 'Modeli za predviđanje potražnje na temelju povijesnih podataka.',
      },
    ],
  },
  {
    id: 8,
    full_name: 'Davor Šimić',
    zavod_code: 'ZEMRIS',
    scientific_fields: ['računalna grafika', 'virtualna stvarnost', 'igre'],
    current_topics: [
      'Razvoj edukativne aplikacije za proširenu stvarnost',
      'Proceduralno generiranje 3D okruženja',
    ],
    theses: [
      {
        id: 801,
        title: 'Razvoj igre u virtualnoj stvarnosti za vježbanje javnog nastupa',
        year: 2023,
        thesis_type: 'diplomski',
        scientific_field: 'virtualna stvarnost',
        keywords: ['virtualna stvarnost', 'igre', 'računalna grafika', 'Unity'],
        source: 'repo',
        abstract: 'VR aplikacija koja simulira publiku za vježbanje prezentacija.',
      },
      {
        id: 802,
        title: 'Proceduralno generiranje terena u stvarnom vremenu',
        year: 2022,
        thesis_type: 'završni',
        scientific_field: 'računalna grafika',
        keywords: ['računalna grafika', 'proceduralno generiranje', 'igre'],
        source: 'repo',
        abstract: 'Algoritmi za generiranje beskonačnog terena u 3D igrama.',
      },
      {
        id: 803,
        title: 'Aplikacija proširene stvarnosti za prikaz arhitektonskih modela',
        year: 2024,
        thesis_type: 'diplomski',
        scientific_field: 'virtualna stvarnost',
        keywords: ['proširena stvarnost', 'AR', 'računalna grafika', '3D'],
        source: 'repo',
        abstract: 'AR aplikacija za vizualizaciju građevinskih projekata na licu mjesta.',
      },
    ],
  },
]

/** Distinct zavod codes present in the data, for filter dropdowns. */
export const ZAVOD_CODES: string[] = Array.from(
  new Set(MOCK_MENTORS.map((m) => m.zavod_code)),
).sort()
