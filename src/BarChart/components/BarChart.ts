import { Component, createElement } from "react";
import * as classNames from "classnames";

import * as elementResize from "element-resize-detector";
import { ScatterHoverData } from "plotly.js";
import { newPlot, purge } from "../../PlotlyCustom";
import { Dimensions, getDimensions } from "../../utils/style";

import "../../ui/Charts.scss";

export interface BarChartProps extends Dimensions {
    orientation: "bar" | "column";
    config?: Partial<Plotly.Config>;
    data?: Plotly.ScatterData[];
    layout?: Partial<Plotly.Layout>;
    className?: string;
    style?: object;
    onClick?: (dataObject: mendix.lib.MxObject, seriesIndex: number) => void;
    onHover?: (node: HTMLDivElement, dataObject: mendix.lib.MxObject) => void;
}

export class BarChart extends Component<BarChartProps, {}> {
    private barChartNode?: HTMLDivElement;
    private tooltipNode: HTMLDivElement;
    private timeoutId: number;
    private data: Partial<Plotly.ScatterData>[] = [
        {
            type: "bar",
            [`${this.props.orientation === "bar" ? "y" : "x"}`]: [ "Sample 1", "Sample 2", "Sample 3", "Sample 4" ],
            [`${this.props.orientation === "bar" ? "x" : "y"}`]: [ 20, 14, 23, 25 ],
            orientation: this.props.orientation === "bar" ? "h" : "v",
            name: "Sample"
        }
    ];

    constructor(props: BarChartProps) {
        super(props);

        this.getPlotlyNodeRef = this.getPlotlyNodeRef.bind(this);
        this.getTooltipNodeRef = this.getTooltipNodeRef.bind(this);
        this.onClick = this.onClick.bind(this);
        this.onHover = this.onHover.bind(this);
        this.clearToolTip = this.clearToolTip.bind(this);
    }

    render() {
        return createElement("div",
            {
                className: classNames("widget-charts-bar", this.props.className),
                ref: this.getPlotlyNodeRef,
                style: { ...getDimensions(this.props), ...this.props.style }
            },
            createElement("div", { className: "widget-charts-tooltip", ref: this.getTooltipNodeRef })
        );
    }

    componentDidMount() {
        this.renderChart(this.props);
        this.addResizeListener();
    }

    componentWillReceiveProps(newProps: BarChartProps) {
        this.renderChart(newProps);
    }

    componentWillUnmount() {
        if (this.barChartNode) {
            purge(this.barChartNode);
        }
    }

    private getPlotlyNodeRef(node: HTMLDivElement) {
        this.barChartNode = node;
    }

    private getTooltipNodeRef(node: HTMLDivElement) {
        this.tooltipNode = node;
    }

    private addResizeListener() {
        const resizeDetector = elementResize({ strategy: "scroll" });
        if (this.barChartNode && this.barChartNode.parentElement) {
            resizeDetector.listenTo(this.barChartNode.parentElement, () => {
                if (this.timeoutId) {
                    clearTimeout(this.timeoutId);
                }
                this.timeoutId = setTimeout(() => {
                    if (this.barChartNode) {
                        purge(this.barChartNode);
                        this.renderChart(this.props);
                    }
                    this.timeoutId = 0;
                }, 100);
            });
        }
    }

    private renderChart(props: BarChartProps) {
        if (this.barChartNode) {
            const data = props.data && props.data.length ? props.data : this.data;
            const layout = props.layout || {};
            layout.width = this.barChartNode.clientWidth;
            layout.height = this.barChartNode.clientHeight;
            newPlot(this.barChartNode, data, layout, props.config)
                .then(myPlot => {
                    myPlot.on("plotly_click", this.onClick);
                    myPlot.on("plotly_hover", this.onHover);
                    myPlot.on("plotly_unhover", this.clearToolTip);
                });
        }
    }

    private onClick(data: ScatterHoverData) {
        const pointClicked = data.points[0];
        if (this.props.onClick) {
            this.props.onClick(pointClicked.data.mxObjects[pointClicked.pointNumber], pointClicked.data.seriesIndex);
        }
    }

    private onHover(data: ScatterHoverData) {
        if (this.props.onHover) {
            const activePoint = data.points[0];
            const yAxisPixels = typeof activePoint.y === "number"
                ? activePoint.yaxis.l2p(activePoint.y)
                : activePoint.yaxis.d2p(activePoint.y);
            const xAxisPixels = typeof activePoint.x === "number"
                ? activePoint.xaxis.l2p(activePoint.x as number)
                : activePoint.xaxis.d2p(activePoint.x);
            const positionYaxis = yAxisPixels + activePoint.yaxis._offset;
            const positionXaxis = xAxisPixels + activePoint.xaxis._offset;
            this.tooltipNode.style.top = `${positionYaxis}px`;
            this.tooltipNode.style.left = `${positionXaxis}px`;
            this.tooltipNode.style.opacity = "1";
            this.props.onHover(this.tooltipNode, activePoint.data.mxObjects[activePoint.pointNumber]);
        }
    }

    private clearToolTip() {
        this.tooltipNode.innerHTML = "";
        this.tooltipNode.style.opacity = "0";
    }
}
