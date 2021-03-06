import { SFC, createElement } from "react";
import BarChartContainer, { BarChartContainerProps } from "../../BarChart/components/BarChartContainer";

const ColumnChartContainer: SFC<BarChartContainerProps> = (props) =>
    createElement(BarChartContainer, { ...props as BarChartContainerProps, orientation: "column" });

export { ColumnChartContainer as default };
