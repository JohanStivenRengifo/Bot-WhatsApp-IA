export interface PaymentPoint {
    id: string;
    name: string;
    address: string;
    schedule: string;
    hours: string;      // Horario de atención
    phone: string;      // Teléfono de contacto
    latitude: number;   // Latitud para ubicación en mapa
    longitude: number;  // Longitud para ubicación en mapa
    coordinates?: {
        lat: number;
        lng: number;
    };
}
