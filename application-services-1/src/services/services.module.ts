import { forwardRef, Module } from "@nestjs/common";
import { OrderFormService } from "./orderform.service";
import { KafkaOb1Module } from "src/kafka-ob1/kafka-ob1.module";


@Module({
    imports:[forwardRef(() => KafkaOb1Module)],
    providers:[OrderFormService],
    exports:[OrderFormService]
})
export class ServicesModule {}