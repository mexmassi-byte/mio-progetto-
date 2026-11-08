"""Reference coordinates for common target cities (lat, lon), used to point
the research globe at a city before individual businesses are found."""

CITIES: dict[str, tuple[float, float]] = {
    # Germany
    "Berlin": (52.520, 13.405), "München": (48.137, 11.575), "Hamburg": (53.551, 9.993),
    "Frankfurt am Main": (50.110, 8.682), "Köln": (50.938, 6.960), "Stuttgart": (48.776, 9.183),
    "Düsseldorf": (51.227, 6.773), "Leipzig": (51.340, 12.375), "Dresden": (51.051, 13.738),
    "Hannover": (52.376, 9.732), "Nürnberg": (49.452, 11.077), "Bremen": (53.079, 8.802),
    "Essen": (51.456, 7.012), "Dortmund": (51.514, 7.468), "Bonn": (50.737, 7.098),
    # Italy
    "Milano": (45.464, 9.190), "Roma": (41.903, 12.496), "Torino": (45.070, 7.687),
    "Genova": (44.405, 8.946), "Bologna": (44.494, 11.343), "Firenze": (43.770, 11.256),
    "Napoli": (40.852, 14.268), "Venezia": (45.441, 12.316), "Verona": (45.438, 10.992),
    "Padova": (45.406, 11.877), "Bari": (41.117, 16.872), "Palermo": (38.116, 13.361),
    # Austria / Switzerland
    "Wien": (48.208, 16.373), "Graz": (47.071, 15.439), "Linz": (48.306, 14.286),
    "Salzburg": (47.809, 13.055), "Zürich": (47.377, 8.541), "Genève": (46.204, 6.143),
    "Basel": (47.560, 7.589), "Bern": (46.948, 7.447),
}


def city_coords(name: str | None) -> tuple[float, float] | None:
    if not name:
        return None
    if name in CITIES:
        return CITIES[name]
    low = name.lower()
    for k, v in CITIES.items():
        if k.lower() == low:
            return v
    return None
