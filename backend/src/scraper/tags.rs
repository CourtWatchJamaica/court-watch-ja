const TAX_KEYWORDS: &[&str] = &[
    "income tax",
    "tax appeal",
    "general consumption tax",
    " gct ",
    "customs duty",
    "customs and excise",
    "national insurance",
    "property tax",
    "transfer tax",
    "stamp duty",
    "tax authority",
    "taxpayer",
    "tax assessment",
    "tax liability",
    "tax evasion",
    "commissioner of inland revenue",
    "inland revenue",
    "tax administration",
    "value added tax",
    " vat ",
    "withholding tax",
    "tax compliance",
];

const CONSTITUTIONAL_KEYWORDS: &[&str] = &[
    "constitution",
    "constitutional",
    "fundamental rights",
    "charter of rights",
    "judicial review",
    "habeas corpus",
    "due process",
    "natural justice",
    "separation of powers",
    "civil liberties",
];

const CRIMINAL_KEYWORDS: &[&str] = &[
    "murder",
    "manslaughter",
    "robbery",
    "burglary",
    "larceny",
    "assault",
    "rape",
    "sexual offence",
    "drug trafficking",
    "firearm",
    "criminal",
    "guilty",
    "acquittal",
    "the queen v",
    "the king v",
    "director of public prosecutions",
    "d.p.p.",
    "crown prosecution",
    "sentencing",
    "bail",
];

const CIVIL_KEYWORDS: &[&str] = &[
    "negligence",
    "tort",
    "personal injury",
    "breach of contract",
    "injunction",
    "specific performance",
    "nuisance",
    "trespass",
    "civil claim",
    "damages",
    "defamation",
    "malicious prosecution",
];

const FAMILY_KEYWORDS: &[&str] = &[
    "divorce",
    "matrimonial",
    "custody",
    "maintenance",
    "child support",
    "adoption",
    "domestic violence",
    "ancillary relief",
    "marriage",
    "separation",
    "parental rights",
    "guardianship",
];

const COMMERCIAL_KEYWORDS: &[&str] = &[
    "company",
    "insolvency",
    "bankruptcy",
    "winding up",
    "shareholder",
    "directorship",
    "banking",
    "mortgage",
    "securities",
    "commercial",
    "intellectual property",
    "trademark",
    "copyright",
    "patent",
    "franchise",
    "joint venture",
];

const PROBATE_KEYWORDS: &[&str] = &[
    "probate",
    "estate of",
    "last will",
    "intestate",
    "executor",
    "administrator",
    "beneficiary",
    "succession",
    "inheritance",
    "letters of administration",
    "grant of probate",
    "testamentary",
];

const LABOUR_KEYWORDS: &[&str] = &[
    "labour",
    "employment",
    "unfair dismissal",
    "wrongful dismissal",
    "redundancy",
    "trade union",
    "industrial dispute",
    "employer",
    "termination of employment",
    "constructive dismissal",
    "labour relations",
    "industrial tribunal",
];

pub fn detect_tags(title: Option<&str>, summary: Option<&str>) -> Vec<String> {
    let combined = format!(
        " {} {} ",
        title.unwrap_or("").to_lowercase(),
        summary.unwrap_or("").to_lowercase()
    );

    let rules: &[(&str, &[&str])] = &[
        ("tax_law", TAX_KEYWORDS),
        ("constitutional", CONSTITUTIONAL_KEYWORDS),
        ("criminal", CRIMINAL_KEYWORDS),
        ("civil", CIVIL_KEYWORDS),
        ("family", FAMILY_KEYWORDS),
        ("commercial", COMMERCIAL_KEYWORDS),
        ("probate", PROBATE_KEYWORDS),
        ("labour", LABOUR_KEYWORDS),
    ];

    rules
        .iter()
        .filter(|(_, keywords)| keywords.iter().any(|kw| combined.contains(kw)))
        .map(|(tag, _)| (*tag).to_string())
        .collect()
}
