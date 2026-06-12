

export type FacilityMarker = {
    id: string,
    name: string,
    lat: number,
    lng: number,
    general_info: string,
    addr: string,
};

export function getFacilityForStudio(studio: string, facilities: FacilityMarker[]) {
    const normalizedStudio = studio.trim().toUpperCase();

    if (normalizedStudio.startsWith("RSC")) {
        return facilities.find((f) => f.name.toLowerCase().includes("recreational sports center"));
    }

    if (normalizedStudio.startsWith("GRE")) {
        return facilities.find((f) => f.name.toLowerCase().includes("gregory gym"));
    }

    return undefined;
}