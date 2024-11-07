import { Module } from "@nestjs/common";
import { OrderFormService } from "./orderform.service";


@Module({
    imports:[],
    providers:[OrderFormService],
    exports:[OrderFormService]
})
export class ServicesModule {}