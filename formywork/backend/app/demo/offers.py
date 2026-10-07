"""Offres d'exemple du mode démo. Entreprises et adresses fictives (domaine example.org)."""

from __future__ import annotations

DEMO_OFFERS: list[dict] = [
    {
        "id": "demo-001",
        "title": "Assistant(e) ressources humaines en alternance (H/F)",
        "company": "Maison Lumen",
        "location": "Lyon 3e",
        "postal_code": "69003",
        "lat": 45.7597,
        "lon": 4.8422,
        "contract": "alternance",
        "remote": "partiel",
        "salary": "Selon grille alternance (de 53 % à 100 % du SMIC)",
        "days_ago": 0,
        "apply_email": "recrutement@maison-lumen.example.org",
        "description": """Maison Lumen, entreprise de 120 salariés spécialisée dans l'éclairage, recherche un(e) assistant(e) RH en alternance pour préparer un BTS SIO ou une licence RH.

Vos missions :
• Participer au recrutement : rédaction et diffusion des annonces, tri des candidatures, organisation des entretiens
• Préparer les éléments variables de paie avec la responsable RH
• Mettre à jour les dossiers du personnel et le registre unique
• Accueillir les nouveaux arrivants (livret d'accueil, planning d'intégration)

Profil recherché :
• Formation Bac+2/Bac+3 en ressources humaines en cours ou à venir
• Bonne maîtrise d'Excel et des outils bureautiques
• Discrétion, rigueur et sens du contact

Conditions : rythme 3 jours entreprise / 2 jours école, 1 jour de télétravail possible, tickets restaurant, mutuelle prise en charge à 70 %.""",
        "summary": [
            "Mission : appui au recrutement, préparation de la paie et suivi des dossiers du personnel.",
            "Profil : étudiant(e) Bac+2/+3 RH, à l'aise avec Excel, discret(e) et rigoureux(se).",
            "Conditions : alternance 3 j entreprise / 2 j école, 1 jour de télétravail, tickets restaurant.",
            "À noter : poste confidentiel (données salariés), candidature par e-mail possible.",
        ],
        "keywords": ["Recrutement", "Paie", "Excel"],
    },
    {
        "id": "demo-002",
        "title": "Développeur web junior – alternance 24 mois",
        "company": "Atelier Numérique du Rhône",
        "location": "Villeurbanne",
        "postal_code": "69100",
        "lat": 45.7719,
        "lon": 4.8902,
        "contract": "alternance",
        "remote": "partiel",
        "salary": "Rémunération légale alternance + prime de transport",
        "days_ago": 1,
        "description": """Rejoignez une agence web de 15 personnes qui conçoit des sites pour des associations et des PME.

Ce que vous ferez :
• Intégrer des maquettes en HTML, CSS et JavaScript
• Développer des fonctionnalités en React et en PHP (Symfony)
• Corriger des anomalies et écrire des tests simples
• Participer aux réunions avec les clients

Ce que nous attendons :
• Préparer un titre de développeur web (Bac+2 à Bac+3)
• Premières bases en JavaScript ; Git est un plus
• Curiosité et envie d'apprendre

Télétravail 2 jours par semaine après la période d'intégration. Matériel fourni.""",
        "summary": [
            "Mission : intégration de maquettes et développement en React et Symfony.",
            "Profil : étudiant(e) en formation développeur web, bases en JavaScript, Git apprécié.",
            "Conditions : alternance 24 mois, 2 jours de télétravail après l'intégration.",
            "À noter : petite équipe, contact direct avec les clients.",
        ],
        "keywords": ["JavaScript", "React", "Git"],
    },
    {
        "id": "demo-003",
        "title": "Comptable confirmé(e) – CDI",
        "company": "Cabinet Berthelot & Associés",
        "location": "Nantes",
        "postal_code": "44000",
        "lat": 47.2184,
        "lon": -1.5536,
        "contract": "cdi",
        "remote": "partiel",
        "salary": "36 000 € à 42 000 € brut par an selon expérience",
        "days_ago": 2,
        "apply_email": "rh@berthelot-associes.example.org",
        "description": """Cabinet d'expertise comptable de 40 collaborateurs, nous renforçons notre pôle PME.

Missions :
• Tenue et révision d'un portefeuille d'une quarantaine de dossiers (BIC, IS)
• Établissement des déclarations fiscales (TVA, liasses)
• Préparation des bilans et relation avec les dirigeants
• Encadrement ponctuel d'un(e) assistant(e)

Profil :
• Expérience de 5 ans minimum en cabinet ; les profils expérimentés sont les bienvenus
• Maîtrise d'un logiciel comptable (Cegid, Sage ou ACD)
• Autonomie et sens du service client

Avantages : 2 jours de télétravail, horaires souples, 13e mois, intéressement.""",
        "summary": [
            "Mission : tenue et révision d'environ 40 dossiers PME, déclarations fiscales et bilans.",
            "Profil : 5 ans d'expérience en cabinet minimum, logiciel comptable (Cegid, Sage ou ACD).",
            "Conditions : CDI, 36 à 42 k€ brut, 13e mois, 2 jours de télétravail.",
            "À noter : profils expérimentés explicitement bienvenus.",
        ],
        "keywords": ["Révision", "Fiscalité", "Cegid"],
    },
    {
        "id": "demo-004",
        "title": "Formateur / formatrice en bureautique – senior bienvenu",
        "company": "Compétences Plus Formation",
        "location": "Bordeaux",
        "postal_code": "33000",
        "lat": 44.8378,
        "lon": -0.5792,
        "contract": "cdi",
        "remote": "non",
        "salary": "2 400 € à 2 800 € brut mensuel",
        "days_ago": 3,
        "description": """Organisme de formation pour adultes, nous recherchons un(e) formateur(trice) pour animer des sessions Word, Excel et outils numériques auprès de demandeurs d'emploi et de salariés en reconversion.

Vos missions :
• Animer des groupes de 8 à 12 personnes
• Adapter les supports pédagogiques au niveau de chacun
• Évaluer les acquis et accompagner vers la certification

Profil :
• Expérience professionnelle significative (une carrière en entreprise est un atout)
• Excellente maîtrise du Pack Office
• Patience, pédagogie, goût pour la transmission
• Titre de formateur professionnel d'adultes apprécié, non obligatoire

Poste du lundi au vendredi, 35 h, en présentiel.""",
        "summary": [
            "Mission : animer des formations Word, Excel et numérique pour adultes en groupes de 8 à 12.",
            "Profil : solide expérience professionnelle, maîtrise du Pack Office, pédagogie.",
            "Conditions : CDI 35 h en présentiel, 2 400 à 2 800 € brut mensuel.",
            "À noter : l'expérience de carrière est valorisée, titre de formateur non obligatoire.",
        ],
        "keywords": ["Pédagogie", "Excel", "Formation adultes"],
    },
    {
        "id": "demo-005",
        "title": "Conseiller(ère) clientèle à distance (H/F)",
        "company": "Assurances Mutuelles du Centre",
        "location": "Télétravail – France entière",
        "postal_code": None,
        "lat": None,
        "lon": None,
        "contract": "cdi",
        "remote": "total",
        "salary": "24 000 € brut annuel + primes",
        "days_ago": 1,
        "description": """Nous recrutons des conseillers clientèle en 100 % télétravail après 3 semaines de formation rémunérée.

Missions :
• Répondre aux appels et e-mails des adhérents
• Expliquer les garanties et traiter les demandes de remboursement
• Proposer des solutions adaptées

Profil :
• Première expérience en relation client appréciée, débutants acceptés
• Bonne expression orale et écrite
• Connexion internet fiable

Horaires : du lundi au vendredi, 9 h – 17 h 30.""",
        "summary": [
            "Mission : répondre aux appels et e-mails des adhérents, traiter leurs demandes.",
            "Profil : débutants acceptés, bonne expression orale et écrite.",
            "Conditions : CDI 100 % télétravail, 24 k€ brut + primes, formation payée de 3 semaines.",
            "À noter : horaires fixes en journée, connexion internet fiable indispensable.",
        ],
        "keywords": ["Relation client", "Téléphone", "Télétravail"],
    },
    {
        "id": "demo-006",
        "title": "Agent(e) d'accueil – CDD 6 mois",
        "company": "Mairie de Saint-Fons",
        "location": "Saint-Fons",
        "postal_code": "69190",
        "lat": 45.7089,
        "lon": 4.8533,
        "contract": "cdd",
        "remote": "non",
        "salary": "SMIC + régime indemnitaire",
        "days_ago": 4,
        "apply_email": "emploi@mairie-saintfons.example.org",
        "description": """La mairie recherche un(e) agent(e) d'accueil pour son hôtel de ville.

Missions :
• Accueillir et orienter le public, physiquement et au téléphone
• Délivrer des informations sur les démarches administratives
• Gérer le courrier et la prise de rendez-vous

Profil :
• Sens de l'écoute et du service public
• Aisance avec l'ordinateur (messagerie, logiciel de rendez-vous)
• Expérience d'accueil appréciée, reconversion bienvenue

CDD de 6 mois renouvelable, 35 h du lundi au vendredi.""",
        "summary": [
            "Mission : accueillir le public, informer sur les démarches, gérer courrier et rendez-vous.",
            "Profil : sens de l'écoute, à l'aise avec l'ordinateur, reconversion bienvenue.",
            "Conditions : CDD 6 mois renouvelable, 35 h en semaine, SMIC + primes.",
            "À noter : candidature par e-mail acceptée.",
        ],
        "keywords": ["Accueil", "Service public", "Organisation"],
    },
    {
        "id": "demo-007",
        "title": "Chargé(e) de communication en alternance",
        "company": "Festival des Lumières Partagées",
        "location": "Lyon 1er",
        "postal_code": "69001",
        "lat": 45.7676,
        "lon": 4.8344,
        "contract": "alternance",
        "remote": "partiel",
        "salary": "Selon grille légale",
        "days_ago": 0,
        "description": """Association culturelle, nous recherchons un(e) alternant(e) en communication (Bac+3 à Bac+5).

Missions :
• Animer nos réseaux sociaux (Instagram, LinkedIn, Facebook)
• Rédiger la newsletter mensuelle
• Créer des visuels simples sur Canva
• Participer à l'organisation des événements

Profil :
• Aisance rédactionnelle et orthographe irréprochable
• Créativité, sens de l'organisation
• Disponibilité certains soirs d'événements (récupérés)

Télétravail un jour par semaine.""",
        "summary": [
            "Mission : réseaux sociaux, newsletter, visuels Canva et organisation d'événements.",
            "Profil : alternant(e) Bac+3 à Bac+5, très bonne orthographe, créatif(ve).",
            "Conditions : alternance, 1 jour de télétravail par semaine.",
            "À noter : quelques soirées d'événements, récupérées.",
        ],
        "keywords": ["Réseaux sociaux", "Rédaction", "Canva"],
    },
    {
        "id": "demo-008",
        "title": "Responsable administratif et financier – expérience 15 ans+",
        "company": "Transports Gauthier",
        "location": "Lille",
        "postal_code": "59000",
        "lat": 50.6292,
        "lon": 3.0573,
        "contract": "cdi",
        "remote": "partiel",
        "salary": "55 000 € à 65 000 € brut annuel",
        "days_ago": 5,
        "description": """PME familiale de transport (180 salariés), nous recherchons notre futur(e) RAF pour accompagner la croissance.

Missions :
• Piloter la comptabilité, la trésorerie et le contrôle de gestion
• Superviser une équipe de 4 personnes
• Être l'interlocuteur des banques, de l'expert-comptable et du commissaire aux comptes
• Superviser la paie et les affaires sociales

Profil :
• Expérience confirmée d'au moins 15 ans dont une partie en PME
• Leadership bienveillant, sens des priorités
• Maîtrise d'un ERP et d'Excel avancé

Télétravail 1 jour par semaine, voiture de fonction.""",
        "summary": [
            "Mission : piloter comptabilité, trésorerie, contrôle de gestion et paie ; encadrer 4 personnes.",
            "Profil : 15 ans d'expérience minimum dont PME, management, ERP et Excel avancé.",
            "Conditions : CDI 55 à 65 k€ brut, voiture de fonction, 1 jour de télétravail.",
            "À noter : poste clé dans une entreprise familiale en croissance.",
        ],
        "keywords": ["Trésorerie", "Management", "Contrôle de gestion"],
    },
    {
        "id": "demo-009",
        "title": "Vendeur(se) conseil en alternance – magasin de bricolage",
        "company": "Brico Proxi Vaulx",
        "location": "Vaulx-en-Velin",
        "postal_code": "69120",
        "lat": 45.7781,
        "lon": 4.9196,
        "contract": "alternance",
        "remote": "non",
        "salary": "Selon grille + prime sur objectifs",
        "days_ago": 2,
        "description": """Préparez un BTS MCO ou NDRC en alternance dans notre magasin.

Missions :
• Conseiller les clients au rayon outillage et jardin
• Mettre en rayon et suivre les stocks
• Participer aux animations commerciales

Profil :
• Goût du contact et du terrain
• Intérêt pour le bricolage
• Ponctualité

Travail un samedi sur deux.""",
        "summary": [
            "Mission : conseil client en rayon, mise en rayon, suivi des stocks.",
            "Profil : préparer un BTS MCO ou NDRC, goût du contact, intérêt pour le bricolage.",
            "Conditions : alternance, prime sur objectifs, un samedi sur deux.",
            "À noter : poste debout et physique.",
        ],
        "keywords": ["Vente", "Conseil client", "BTS MCO"],
    },
    {
        "id": "demo-010",
        "title": "Assistant(e) de gestion PME – reconversion acceptée",
        "company": "Menuiserie Fabre",
        "location": "Toulouse",
        "postal_code": "31000",
        "lat": 43.6047,
        "lon": 1.4442,
        "contract": "cdi",
        "remote": "non",
        "salary": "2 000 € à 2 300 € brut mensuel",
        "days_ago": 6,
        "apply_email": "contact@menuiserie-fabre.example.org",
        "description": """Entreprise artisanale de 12 salariés, nous cherchons un(e) assistant(e) polyvalent(e).

Missions :
• Établir les devis et les factures
• Relancer les impayés et suivre les règlements
• Gérer l'agenda des chantiers et l'accueil téléphonique

Profil :
• Expérience administrative appréciée, personnes en reconversion bienvenues (formation interne)
• Rigueur, bon relationnel
• Bureautique courante

Horaires de journée, du lundi au vendredi.""",
        "summary": [
            "Mission : devis, factures, relances et planning des chantiers.",
            "Profil : expérience administrative appréciée, reconversion bienvenue avec formation interne.",
            "Conditions : CDI, 2 000 à 2 300 € brut mensuel, horaires de journée.",
            "À noter : petite entreprise artisanale, poste très polyvalent.",
        ],
        "keywords": ["Facturation", "Devis", "Polyvalence"],
    },
    {
        "id": "demo-011",
        "title": "Intérim – Préparateur(trice) de commandes",
        "company": "Agence Temporis",
        "location": "Corbas",
        "postal_code": "69960",
        "lat": 45.6681,
        "lon": 4.9022,
        "contract": "interim",
        "remote": "non",
        "salary": "12,50 € brut de l'heure + paniers",
        "days_ago": 1,
        "description": """Pour notre client, entrepôt logistique, nous recherchons des préparateurs de commandes.

Missions : préparation de colis avec scanner, contrôle et filmage des palettes.
Profil : CACES 1 apprécié, rigueur et ponctualité.
Mission de 3 mois, horaires en 2x8.""",
        "summary": [
            "Mission : préparer les commandes au scanner, contrôler et filmer les palettes.",
            "Profil : rigueur, ponctualité ; CACES 1 apprécié.",
            "Conditions : intérim 3 mois, 12,50 € brut/h + paniers, horaires en 2x8.",
            "À noter : travail physique en horaires décalés.",
        ],
        "keywords": ["Logistique", "Préparation", "CACES"],
    },
    {
        "id": "demo-012",
        "title": "Chef de projet informatique – CDI",
        "company": "Hôpital privé du Parc",
        "location": "Paris 15e",
        "postal_code": "75015",
        "lat": 48.8412,
        "lon": 2.3003,
        "contract": "cdi",
        "remote": "partiel",
        "salary": "50 000 € à 58 000 € brut annuel",
        "days_ago": 3,
        "description": """Au sein de la DSI (20 personnes), vous pilotez les projets applicatifs liés au dossier patient.

Missions :
• Recueillir les besoins des équipes soignantes
• Piloter les éditeurs et le planning
• Organiser la recette et la formation des utilisateurs

Profil :
• 7 ans d'expérience en gestion de projet SI
• Connaissance du secteur santé appréciée
• Excellentes qualités d'écoute

Télétravail 2 jours par semaine.""",
        "summary": [
            "Mission : piloter les projets logiciels du dossier patient, de l'expression du besoin à la formation.",
            "Profil : 7 ans d'expérience en gestion de projet SI, secteur santé apprécié.",
            "Conditions : CDI 50 à 58 k€ brut, 2 jours de télétravail.",
            "À noter : nombreux échanges avec les soignants.",
        ],
        "keywords": ["Gestion de projet", "Recette", "Santé"],
    },
]

# Offres qui « arrivent » au fil du temps en mode démo, pour voir le badge Nouveau et les notifications.
DEMO_INCOMING: list[dict] = [
    {
        "id": "demo-101",
        "title": "Gestionnaire de paie en alternance",
        "company": "Groupe Hestia Services",
        "location": "Lyon 7e",
        "postal_code": "69007",
        "lat": 45.7457,
        "lon": 4.8421,
        "contract": "alternance",
        "remote": "partiel",
        "salary": "Selon grille légale",
        "apply_email": "alternance@hestia.example.org",
        "description": """Vous préparez un titre de gestionnaire de paie. Vous contrôlez les éléments variables, établissez les bulletins de 150 salariés avec votre tutrice et répondez aux questions des salariés. Rigueur et discrétion indispensables. Télétravail 1 jour par semaine.""",
        "summary": [
            "Mission : préparer les bulletins de 150 salariés avec une tutrice, contrôler les variables.",
            "Profil : formation gestionnaire de paie en cours, rigueur et discrétion.",
            "Conditions : alternance, 1 jour de télétravail par semaine.",
            "À noter : candidature par e-mail possible.",
        ],
        "keywords": ["Paie", "Rigueur", "Confidentialité"],
    },
    {
        "id": "demo-102",
        "title": "Secrétaire médical(e) – CDI temps partiel",
        "company": "Centre de santé Bellecour",
        "location": "Lyon 2e",
        "postal_code": "69002",
        "lat": 45.7578,
        "lon": 4.8320,
        "contract": "cdi",
        "remote": "non",
        "salary": "1 500 € brut pour 24 h par semaine",
        "description": """Accueil des patients, prise de rendez-vous, gestion des dossiers médicaux. Expérience en secrétariat appréciée, reconversion possible avec formation. Poste à 24 h par semaine, idéal pour concilier vie personnelle et professionnelle.""",
        "summary": [
            "Mission : accueil des patients, rendez-vous et dossiers médicaux.",
            "Profil : expérience en secrétariat appréciée, reconversion possible.",
            "Conditions : CDI 24 h par semaine, 1 500 € brut.",
            "À noter : temps partiel choisi.",
        ],
        "keywords": ["Secrétariat", "Accueil", "Temps partiel"],
    },
    {
        "id": "demo-103",
        "title": "Technicien(ne) support informatique – alternance",
        "company": "InfoServ Rhône",
        "location": "Bron",
        "postal_code": "69500",
        "lat": 45.7386,
        "lon": 4.9133,
        "contract": "alternance",
        "remote": "non",
        "salary": "Selon grille légale",
        "description": """Préparez un BTS SIO option SISR. Vous installez les postes, répondez aux tickets des utilisateurs et participez à la gestion du parc informatique (Windows, Microsoft 365). Bon relationnel et patience attendus.""",
        "summary": [
            "Mission : installer les postes, traiter les tickets, gérer le parc informatique.",
            "Profil : préparer un BTS SIO SISR, bon relationnel et patience.",
            "Conditions : alternance en présentiel.",
            "À noter : environnement Windows et Microsoft 365.",
        ],
        "keywords": ["Support", "Windows", "Microsoft 365"],
    },
]
