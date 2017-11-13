import { Component, ReactChild, createElement } from "react";
import AceEditor, { Marker, Mode } from "react-ace";
import * as classNames from "classnames";
import { Operation, compare } from "fast-json-patch";
import jsonMap = require("json-source-map");

import { Accordion, AccordionProps } from "./Accordion";
import { Alert } from "./Alert";
import { MendixButton } from "./MendixButton";
import { Sidebar } from "./Sidebar";
import { TabContainer } from "./TabContainer";
import { TabHeader } from "./TabHeader";
import { TabPane } from "./TabPane";
import { TabTool } from "./TabTool";

import "brace";
import { ScatterTrace, SeriesData, SeriesProps } from "../utils/data";
import { PieTraces } from "../PieChart/components/PieChart";
import { PieData, ScatterData } from "plotly.js";

import "brace/mode/json";
import "brace/mode/javascript";
import "brace/theme/github";

interface PlaygroundProps {
    pie?: PiePlaygroundOptions;
    series?: SeriesPlaygroundOptions;
    layoutOptions: string;
    modelerLayoutConfigs: string;
}

interface PiePlaygroundOptions {
    dataOptions: string;
    modelerDataConfigs: string;
    chartData: Partial<PieData>[];
    traces: PieTraces;
    onChange?: (layout: string, data: string) => void;
}

interface SeriesPlaygroundOptions {
    modelerSeriesConfigs?: string[];
    rawData?: SeriesData[];
    chartData?: Partial<ScatterData>[];
    traces?: PlaygroundSeriesTrace[];
    onChange?: (layout: string, data: SeriesData[]) => void;
}

type PlaygroundSeriesTrace = ({ name: string } & ScatterTrace);

export class Playground extends Component<PlaygroundProps, { showEditor: boolean }> {
    private updatedSeriesOptions: { layout: string, data: SeriesData[] };
    private updatedPieOptions: { layout: string, data: string };
    private timeoutId: number;
    private isValid: boolean;

    constructor(props: PlaygroundProps) {
        super(props);

        this.updateChart = this.updateChart.bind(this);
        this.onValidate = this.onValidate.bind(this);
        this.toggleShowEditor = this.toggleShowEditor.bind(this);
        this.closeEditor = this.closeEditor.bind(this);

        this.state = { showEditor: false };
        this.updatedSeriesOptions = {
            layout: props.layoutOptions || "{}",
            data: props.series && props.series.rawData || []
        };
        this.updatedPieOptions = {
            layout: props.layoutOptions || "{}",
            data: props.pie && props.pie.dataOptions || "{/n/n}"
        };
    }

    render() {
        return createElement("div", {
                className: classNames("widget-charts-playground", {
                    "playground-open": this.state.showEditor
                })
            },
            createElement(Sidebar,
                {
                    open: this.state.showEditor,
                    onBlur: this.closeEditor
                },
                this.renderTabs()
            ),
            createElement("div", { className: "widget-charts-playground-toggle" },
                createElement(MendixButton, { onClick: this.toggleShowEditor }, "Toggle Editor")
            ),
            this.props.children
        );
    }

    private renderTabs() {
        if (this.props.pie) {
            return createElement(TabContainer, { tabHeaderClass: "control-sidebar-tabs", justified: true },
                createElement(TabHeader, { title: "Layout" }),
                createElement(TabHeader, { title: "Data" }),
                createElement(TabHeader, { title: "Help" }),
                createElement(TabPane, {}, this.renderLayoutOptions()),
                createElement(TabPane, {}, this.renderPieDataPanes()),
                createElement(TabPane, { className: "widget-charts-playground-help" }, this.renderHelpContent()),
                this.renderSidebarCloser()
            );
        }

        return createElement(TabContainer, { tabHeaderClass: "control-sidebar-tabs", justified: true },
            createElement(TabHeader, { title: "Layout" }),
            createElement(TabPane, {}, this.renderLayoutOptions()),
            ...this.renderSeriesTabHeaders(),
            ...this.renderSeriesTabPanes(),
            this.renderSidebarCloser(),
            createElement(TabHeader, { title: "Help" }),
            createElement(TabPane, { className: "widget-charts-playground-help" }, this.renderHelpContent())
        );
    }

    private renderSidebarCloser() {
        return createElement(TabTool, { className: "pull-right remove", onClick: this.toggleShowEditor },
            createElement("em", { className: "glyphicon glyphicon-chevron-right" })
        );
    }

    private renderSeriesTabHeaders() {
        if (this.props.series && this.props.series.rawData) {
            return this.props.series.rawData.map(({ series }, index) =>
                createElement(TabHeader, { title: series.name, key: `series-header-${index}` })
            );
        }

        return [];
    }

    private renderSeriesTabPanes() {
        if (this.props.series && this.props.series.rawData) {
            return this.props.series.rawData.map(({ series }, index) =>
                createElement(TabPane, { key: `series-pane-${index}` },
                    this.renderSeriesOptions(series, index),
                    this.renderSeriesModelerConfig(index)
                )
            );
        }

        return [];
    }

    private renderSeriesOptions(series: SeriesProps, index: number) {
        return createElement(Accordion,
            {
                title: "Advanced options",
                titleClass: "item-header",
                show: true,
                collapsible: false
            },
            this.renderAceEditor(series.seriesOptions || "{\n\n}", value =>
                this.onUpdate(`series-${index}`, value)
            )
        );
    }

    private renderSeriesModelerConfig(index: number) {
        if (this.props.series && this.props.series.modelerSeriesConfigs && this.props.series.rawData) {
            return createElement(Accordion,
                {
                    title: "Modeler",
                    titleClass: "item-header",
                    show: true,
                    collapsible: false
                },
                this.renderAceEditor(
                    this.props.series.modelerSeriesConfigs[index] || "{\n\n}",
                    undefined,
                    true,
                    "json",
                    this.props.series.rawData[index].series.seriesOptions
                )
            );
        }

        return null;

    }

    private renderHelpContent() {
        return createElement(Alert, { key: 0, bootstrapStyle: "info" },
            this.renderParagraph(createElement("em", { className: "glyphicon glyphicon-exclamation-sign" }),
                "  Changes made in this editor are only for preview purposes and are not automatically saved to the widget"
            ),
            this.renderParagraph("The JSON can be copied and pasted into the widget in the desktop and web modelers."),
            this.renderParagraph("Plotly API reference: ",
                createElement("a", { href: "https://plot.ly/javascript/reference/", className: "" },
                    "https://plot.ly/javascript/reference/"
                )
            )
        );
    }

    private renderParagraph(...content: ReactChild[]) {
        return createElement("p", {}, content);
    }

    private getStartAndEndPosOfDiff(textValue: string, diff: Operation) {
        const result = jsonMap.parse(textValue);
        const pointer = result.pointers[diff.path];
        if (pointer) {
            return {
                startRow: pointer.key.line,
                startCol: pointer.key.column,
                endRow: pointer.valueEnd.line,
                endCol: pointer.valueEnd.column
            };
        }
    }

    private getMarker(left: string, right?: string): Marker[] {
        const markers: Marker[] = [];
        if (right) {
            const diffs = compare(JSON.parse(left), JSON.parse(right));
            diffs.forEach(diff => {
                if (diff.op === "replace") {
                    const pos = this.getStartAndEndPosOfDiff(left, diff);
                    if (pos) {
                        markers.push({
                            startRow: pos.startRow,
                            startCol: pos.startCol,
                            endRow: pos.endRow,
                            endCol: pos.endCol,
                            type: "text",
                            className: "replaced-config"
                        });
                    }
                }
            });
        }
        return markers;
    }

    private renderAceEditor(value: string, onChange?: (value: string) => void, readOnly = false, mode: Mode = "json", overwriteValue?: string) {
        const markers = this.getMarker(value, overwriteValue);

        return createElement(AceEditor, {
            mode,
            value,
            readOnly,
            onChange,
            theme: "github",
            className: readOnly ? "ace-editor-read-only" : undefined,
            markers,
            maxLines: 1000, // crappy attempt to avoid a third scroll bar
            onValidate: this.onValidate,
            editorProps: { $blockScrolling: Infinity }
        });
    }

    private setAccordionProps(title: string, titleClass: string, show = true): AccordionProps {
        return { title, titleClass, show, collapsible: false };
    }

    private renderLayoutOptions() {
        return [
            createElement(Accordion,
                {
                    key: "layout",
                    ...this.setAccordionProps("Advanced options", "item-header")
                },
                this.renderAceEditor(this.props.layoutOptions, value => this.onUpdate("layout", value))
            ),
            createElement(Accordion,
                {
                    key: "modeler",
                    ...this.setAccordionProps("Modeler", "item-header")
                },
                this.renderAceEditor(this.props.modelerLayoutConfigs, undefined, true, "json", this.props.layoutOptions)
            )
        ];
    }

    private renderPieDataPanes() {
        if (this.props.pie && this.props.pie.dataOptions) {
            const { dataOptions, modelerDataConfigs } = this.props.pie;

            return [
                createElement(Accordion,
                    {
                        key: "data",
                        ...this.setAccordionProps("Data options", "item-header")
                    },
                    this.renderAceEditor(dataOptions, value => this.onUpdate("data", value))
                ),
                createElement(Accordion,
                    {
                        key: "modeler",
                        ...this.setAccordionProps("Modeler", "item-header")
                    },
                    this.renderAceEditor(modelerDataConfigs, undefined, true, "json", dataOptions)
                )
            ];
        }

        return null;
    }

    private toggleShowEditor() {
        this.setState({ showEditor: !this.state.showEditor });
    }

    private closeEditor() {
        if (this.state.showEditor) {
            this.setState({ showEditor: false });
        }
    }

    private onUpdate(source: string, value: string) {
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }
        this.timeoutId = setTimeout(() => {
            if (this.isValid) {
                this.updateChart(source, value);
            }
        }, 1000);
    }

    private onValidate(annotations: object[]) {
        this.isValid = !annotations.length;
    }

    private updateChart(source: string, value: string) {
        if (source === "layout") {
            this.updatedSeriesOptions.layout = value;
        }
        if (source.indexOf("series") > -1) {
            const index = source.split("-")[ 1 ];
            (this.updatedSeriesOptions.data[ parseInt(index, 10) ] as SeriesData).series.seriesOptions = value;
        } else if (source.indexOf("data") > -1) {
            this.updatedPieOptions.data = value;
        }
        if (this.props.series && this.props.series.onChange) {
            this.props.series.onChange(this.updatedSeriesOptions.layout, this.updatedSeriesOptions.data);
        }
        if (this.props.pie && this.props.pie.onChange) {
            this.props.pie.onChange(this.updatedSeriesOptions.layout, this.updatedPieOptions.data);
        }
    }
}
