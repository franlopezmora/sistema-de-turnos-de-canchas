import { CourtRepository } from '../repositories/CourtRepository';
import { getUserClubContext } from '../utils/getUserClubContext';
// Si tienes tipos definidos para la cancha, impórtalos aquí (ej: CreateCourtDto)

export class CourtService {
    private courtRepository: CourtRepository;

    constructor() {
        this.courtRepository = new CourtRepository();
    }

    async resolveClubIdForUser(userId: number, preferredClubId?: number) {
        const context = await getUserClubContext(userId, preferredClubId);
        return context.clubId;
    }


    async deleteCourt(id: number) {
        // Aquí se llama a la función que hicimos en el paso anterior
        return await this.courtRepository.deleteCourt(id);
    }
}