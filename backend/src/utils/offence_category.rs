/// Single source of truth for Parish Court offence categorisation.
///
/// Previously this keyword matching was duplicated three times (frontend
/// display logic, backend detail-page tallies, backend SQL filter clause)
/// and had drifted out of sync with each other. Everything — case badges,
/// analytics tallies, and the `?category=` filter — now derives from the
/// keyword lists below.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Category {
    Violent,
    Property,
    Drugs,
    Other,
}

impl Category {
    pub fn as_str(self) -> &'static str {
        match self {
            Category::Violent => "Violent",
            Category::Property => "Property",
            Category::Drugs => "Drugs",
            Category::Other => "Other",
        }
    }

    pub fn from_str_loose(s: &str) -> Option<Category> {
        match s.to_lowercase().trim() {
            "violent" => Some(Category::Violent),
            "property" => Some(Category::Property),
            "drugs" => Some(Category::Drugs),
            "other" => Some(Category::Other),
            _ => None,
        }
    }
}

pub const VIOLENT_KEYWORDS: &[&str] = &[
    "murder", "attempted murder", "manslaughter",
    "assault", "ass ob", "ob harm", "o b harm", "bodily harm",
    "wounding", "unlawful wounding", "wounding with intent",
    "shooting", "stabbing", "arson",
    "robbery", "rape",
    "indecent assault", "gross indecen",
    "sexual", "grievous",
    "gun", "firearm", "ammunition",
    "threat", "threatening", "stone throwing", "abduction",
    "weapon", "prohibited weapon",
    "buggery",
    "sex with",
    "cruelty",
    "causing death",
    "g s a", "g b h", "s i w p u s",
];

pub const DRUG_KEYWORDS: &[&str] = &[
    "ganja", "cannabis", "cocaine", "crack",
    "dangerous drug", "controlled substance",
    "possession of ganja", "possession of cocaine",
    "drug trafficking", "trafficking", "traffick",
    "cultivation",
    "export of", "import of",
];

pub const PROPERTY_KEYWORDS: &[&str] = &[
    "larceny", "praedial larceny",
    "theft", "stealing", "receiving stolen",
    "burglary", "housebreaking", "breaking",
    "fraud", "forgery", "obtaining", "false pretences",
    "malicious destruction", "malicious", "mal dest", "ma dest",
    "toll evasion",
    "embezzlement", "forged", "uttering", "counterfeit",
    "identity information", "id information", "id info", "identity info",
    "access device",
];

/// Lowercases, folds periods to spaces, and collapses runs of whitespace —
/// matching abbreviated offence text like "G.S.A." or "O. B. Harm".
fn normalise(offence: &str) -> String {
    let folded: String = offence
        .to_lowercase()
        .chars()
        .map(|c| if c == '.' { ' ' } else { c })
        .collect();
    folded.split_whitespace().collect::<Vec<_>>().join(" ")
}

/// Categorise an offence description. Priority: Violent > Drugs > Property > Other,
/// matching the historical frontend behaviour (e.g. "armed robbery to obtain drugs"
/// reads as Violent, not Property).
pub fn categorise(offence: Option<&str>) -> Category {
    let Some(offence) = offence else { return Category::Other };
    let o = normalise(offence);
    if VIOLENT_KEYWORDS.iter().any(|k| o.contains(k)) {
        return Category::Violent;
    }
    if DRUG_KEYWORDS.iter().any(|k| o.contains(k)) {
        return Category::Drugs;
    }
    if PROPERTY_KEYWORDS.iter().any(|k| o.contains(k)) {
        return Category::Property;
    }
    Category::Other
}

/// Keywords for a given category, for building a SQL `ILIKE ANY(...)` filter.
/// `Other` has no keyword list of its own — callers should filter on the
/// negation of Violent ∪ Drugs ∪ Property instead (see `category::sql_other_exclusions`).
pub fn keywords(cat: Category) -> &'static [&'static str] {
    match cat {
        Category::Violent => VIOLENT_KEYWORDS,
        Category::Drugs => DRUG_KEYWORDS,
        Category::Property => PROPERTY_KEYWORDS,
        Category::Other => &[],
    }
}

/// All keywords across Violent, Drugs, and Property — used to build the
/// "NOT ILIKE ANY(...)" clause for the Other category.
pub fn all_categorised_keywords() -> Vec<&'static str> {
    VIOLENT_KEYWORDS
        .iter()
        .chain(DRUG_KEYWORDS.iter())
        .chain(PROPERTY_KEYWORDS.iter())
        .copied()
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn violent_beats_property_and_drugs() {
        assert_eq!(categorise(Some("Robbery with Aggravation")), Category::Violent);
        assert_eq!(categorise(Some("Armed Robbery to Obtain Ganja")), Category::Violent);
    }

    #[test]
    fn drugs_before_property() {
        assert_eq!(categorise(Some("Possession of Ganja")), Category::Drugs);
    }

    #[test]
    fn abbreviations_match_after_normalisation() {
        assert_eq!(categorise(Some("G.S.A.")), Category::Violent);
        assert_eq!(categorise(Some("O. B. Harm")), Category::Violent);
    }

    #[test]
    fn unmatched_offence_is_other() {
        assert_eq!(categorise(Some("Breach of Bail Conditions")), Category::Other);
        assert_eq!(categorise(None), Category::Other);
    }
}
