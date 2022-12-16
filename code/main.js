const QiuchangData = {
    width: 500,
    height: 470,
}

function toulanweizhi(qiuyuan, time, period) {
    d3.select("#svgcontainer").remove();
    d3.select("#shottracker").append("div").attr("id", "svgcontainer");
    let svg = d3.select("#svgcontainer")
        .append("svg").attr("width", QiuchangData.width).attr("height", QiuchangData.height);

    const qiuchang = new Qiuchang(svg);
    qiuchang.drawqiuchang();

    new Toulan(svg, qiuyuan, time, period);
}
class Main {
    constructor() {
        this._height = 120 * 5.75;
        this._width = 80 * 5.75;
        this._dom = "body";
        this._margin = { left: 30, right: 30, top: 30, bottom: 30 };
        this._games = Promise.resolve([]);
        this._teams = Promise.resolve([]);
        this._player_stats = d3.json("data/player.json");
        this._all_player_stats = d3.json("data/allplayer.json");
        this._all_player_shots = d3.csv("data/all_players.csv");
        this._skeys = ['出场次数', '盖帽', '抢断'];
        this._bkeys = ['总出场时间', '得分', '篮板', '助攻'];
        this._pkeys = ['投篮命中率', '三分球命中率'];
        this._begin_end = [-1, Infinity];
        this._thisteam = "比赛双方";
        this._thisplayer = null;
        this._tl_width = 800;
        this._tl_height = 400;
        this._tl_margin = { left: 30, right: 30, top: 30, bottom: 30 };
        this._theme = d3.json("code/vintage.project.json");
    }
    selectdom(dom) {
        this._dom = dom;
        return this;
    }
    game_id(id) {
        if (this._game_id === id)
            return this;
        this._game_id = id;
        let games = d3.json("data/game/" + id + ".json");
        let teams = d3.json("data/team/" + id + ".json");
        this._games = games;
        this._teams = teams;
        this.chooseplayer(null);
        this.chooseteam("比赛双方");
        this._begin_end = [-1, Infinity];
        return this;
    }
    chooseplayer(id) {
        this._thisplayer = id;
        return this;
    }
    chooseteam(t) {
        if (this._thisteam === t)
            return this;
        this._thisteam = t;
        this.chooseplayer(null);
        return this;
    }
    team_dom(dom) {
        this._team_dom = dom;
        return this;
    }
    team_dom_uptime() {
        const _this = this;
        const team_dom = d3.select(this._team_dom);
        let ans = this._teams.then(function (teams) {
            const team_name1 = teams[0].team_name, team_name2 = teams[1].team_name;
            let if_CHOOSE_1 = "", if_CHOOSE_2 = "", if_choose_1_2 = "";
            if (_this._thisteam === "比赛双方")
                if_choose_1_2 = "checked";
            else if (_this._thisteam === "1")
                if_CHOOSE_1 = "checked";
            else if (_this._thisteam === "2")
                if_CHOOSE_2 = "checked";
            const html = `
            <input type="radio" name="team" class="chooseteam" id="chooseteam-1" value="1" ${if_CHOOSE_1}/>
            <label for="chooseteam-1" id="labelA">${team_name1}</label>
            <input type="radio" name="team" class="chooseteam" id="chooseteam-both" value="比赛双方" ${if_choose_1_2}/>
            <label for="chooseteam-both" id="both">比赛双方</label>
            <input type="radio" name="team" class="chooseteam" id="chooseteam-2" value="2" ${if_CHOOSE_2}/>
            <label for="chooseteam-2" id="labelB">${team_name2}</label>
            `;
            let wrapper = team_dom.selectAll("div.chooseteam-wrapper")
                .data([_this._game_id], d => d);
            wrapper.exit().remove();
            wrapper.enter()
                .append("div")
                .attr("class", "chooseteam-wrapper")
                .html(html)
                .selectAll("input.chooseteam")
                .on("change", function () {
                    let value = this.value;
                    _this.chooseteam(value);
                    _this.draw();
                });
        });
        return ans;
    }
    timeline(div) {
        let timelinediv = d3.select(div);
        let tl_width = this._tl_width;
        let tl_height = this._tl_height;
        let tl_margin = this._tl_margin;
        timelinediv.selectAll("svg").data([0])
            .enter()
            .append("svg")
            .merge(timelinediv)
            .attr("width", tl_width + tl_margin.left + tl_margin.right)
            .attr("height", tl_height + tl_margin.top + tl_margin.bottom);
        this._timeline = timelinediv.select("svg");
        return this;
    }
    timeline_uptime() {
        const _this = this;
        const tl_width = this._tl_width;
        const tl_height = this._tl_height;
        const tl_margin = this._tl_margin;
        const ym = tl_margin.top + (tl_height / 2);
        const dm = 50;
        const timeline = this._timeline;
        const tl_scaleX = d3.scaleLinear().range([tl_margin.left, tl_margin.left + tl_width]);
        const tl_scaleY_t1 = d3.scaleLinear()
            .range([ym + dm, tl_margin.top + tl_height])
            .domain([0, 0.0015]);
        const tl_scaleY_t2 = d3.scaleLinear()
            .range([ym - dm, tl_margin.top])
            .domain([0, 0.0015]);
        let ans = Promise.all([this._games, this._teams]).then(function ([games, teams]) {
            const get_seconds = function (game) {
                return game.minute * 60 + game.second;
            };
            tl_scaleX.domain([0, get_seconds(games.slice(-1)[0])]);
            const scaleTeamColor = d3.scaleOrdinal()
                .domain(teams.map(d => d.team_id))
                .range(["#dfd279", "#85d8e9"]);
            const kernelDensityEstimator = function (k, X) {
                function kernelEpanechnikov(k) {
                    return function (v) {
                        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
                    };
                }
                let kernel = kernelEpanechnikov(k);
                return function (V) {
                    return X.map(function (x) {
                        return [x, d3.mean(V, function (v) { return kernel(x - v); })];
                    });
                };
            };
            const pass_ball = games.filter(d => d.type.name === "Pass");
            const pass_ball1 = pass_ball.filter(d => d.team.id === teams[0].team_id);
            const pass_ball2 = pass_ball.filter(d => d.team.id === teams[1].team_id);

            const kde_es = kernelDensityEstimator(100, tl_scaleX.ticks(60));//可以调整这两个数值来更改密度计算效果让曲线更平滑
            const density1 = kde_es(pass_ball1.map(get_seconds));
            const density2 = kde_es(pass_ball2.map(get_seconds));

            const pass_ball_pinlv_t1 = timeline.selectAll("path.pass_ball_pinlv_t1")
                .data([density1]);
            const pass_ball_pinlv_t2 = timeline.selectAll("path.pass_ball_pinlv_t2")
                .data([density2]);
            pass_ball_pinlv_t1.enter()
                .append("path")
                .attr("class", "pass_ball_pinlv_t1")
                .merge(pass_ball_pinlv_t1)
                .attr("stroke", "#dda977")
                .attr("fill", "#dda977")
                .attr("stroke-width", 1)
                .attr("stroke-linejoin", "round")
                .attr("d", d3.area()
                    .curve(d3.curveBasis)
                    .x(d => tl_scaleX(d[0]))
                    .y1(d => tl_scaleY_t1(d[1]))
                    .y0(ym + dm));
            pass_ball_pinlv_t2.enter()
                .append("path")
                .attr("class", "pass_ball_pinlv_t2")
                .merge(pass_ball_pinlv_t2)
                .attr("stroke", "#85d8e9")
                .attr("fill", "#85d8e9")
                .attr("stroke-width", 1)
                .attr("stroke-linejoin", "round")
                .attr("d", d3.area()
                    .curve(d3.curveBasis)
                    .x(d => tl_scaleX(d[0]))
                    .y1(d => tl_scaleY_t2(d[1]))
                    .y0(ym - dm));
            let kongqiu = []; {
                let last_kongqiu, last_kongqiu_time;
                games.forEach((d, i, array) => {
                    let current_kongqiu = d.kongqiu_team.id;
                    let current_kongqiu_time = get_seconds(d);
                    if (last_kongqiu === undefined) {
                        last_kongqiu = current_kongqiu;
                        last_kongqiu_time = current_kongqiu_time;
                        return;
                    }
                    if (last_kongqiu === current_kongqiu) {
                        if (i !== array.length - 1)
                            return;
                    }
                    kongqiu.push({ start: last_kongqiu_time, end: current_kongqiu_time, kongqiu: last_kongqiu });
                    last_kongqiu = current_kongqiu;
                    last_kongqiu_time = current_kongqiu_time;
                    return;
                });
                kongqiu = kongqiu.filter(d => d.start !== d.end);
            };
            const padding_middle = 15, rect_height = 11;
            const scaleRectY = d3.scaleOrdinal()
                .domain(teams.map(d => d.team_id))
                .range([ym + padding_middle, ym - padding_middle - rect_height]);

            let kongqiu_pic = timeline.selectAll("g.kongqiu")
                .data([_this._game_id], d => d);
            kongqiu_pic.exit().remove();
            kongqiu_pic.enter()
                .append("g")
                .attr("class", "kongqiu")
                .selectAll("rect.kongqiu")
                .data(kongqiu)
                .enter()
                .append("rect")
                .attr("class", "kongqiu")
                .attr("x", d => tl_scaleX(d.start))
                .attr("y", d => scaleRectY(d.kongqiu))
                .attr("width", d => tl_scaleX(d.end) - tl_scaleX(d.start))
                .attr("height", rect_height)
                .attr("stroke", "#E7FEFE")
                .attr("fill", d => scaleTeamColor(d.kongqiu));

            const toulan = games.filter(d => d.type.name === "Shot");
            const defen = function (game) {
                return game.shot.outcome.name === "Goal";
            };
            const starsymbol = d3.symbol().type(d3.symbolTriangle);

            const scaleStarY = d3.scaleOrdinal()
                .domain(teams.map(d => d.team_id))
                .range([ym + dm - 13, ym - dm + 15]);
            let toulan_pic = timeline.selectAll("g.shots")
                .data([_this._game_id], d => d);
            toulan_pic.exit().remove();
            toulan_pic.enter()
                .append("g")
                .attr("class", "shots")
                .selectAll("path.shot")
                .data(toulan)
                .enter()
                .append("path")
                .attr("class", "shot")
                .attr("d", d => {
                    if (defen(d))
                        return starsymbol.size(100)(d);
                    else
                        return starsymbol.size(70)(d);
                })
                .attr("fill", d => {
                    if (defen(d))
                        return "IndianRed";
                    else
                        return "MediumSeaGreen";
                })
                .attr("stroke", d => {
                    if (defen(d))
                        return "IndianRed";
                    else
                        return "MediumSeaGreen";
                })
                .attr("transform", d => {
                    let x = tl_scaleX(get_seconds(d));
                    let y = scaleStarY(d.team.id);
                    return `translate(${x}, ${y})`;
                });

            let xaxis = timeline.selectAll("g.xaxis")
                .data([_this._game_id], d => d);
            xaxis.enter()
                .append("g")
                .attr("class", "xaxis")
                .attr("transform", `translate(0, ${ym})`)
                .call(d3.axisBottom(tl_scaleX)
                    .tickFormat(d => Math.round(d / 60) + "m")
                    .tickSize(-3)
                    .tickValues([5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(d => d * 60)))
                .attr("fill", "black")
                .attr("stroke", "black")
                ;
            xaxis.exit()
                .remove();

            const brush = function (d, i) {
                const main = _this;
                const brush = d3.brushSelection(this);
                if (brush === null) {
                    main._begin_end = [-1, Infinity];
                    main.draw();
                    return;
                }
                const start = tl_scaleX.invert(brush[0]);
                const end = tl_scaleX.invert(brush[1]);
                main._begin_end = [start, end];
                main.draw();
            };
            const brush_pic = timeline.selectAll("g.brush")
                .data([_this._game_id], d => d);
            brush_pic
                .enter()
                .append("g")
                .attr("class", "brush")
                .call(d3.brushX()
                    .extent([[tl_margin.left, tl_margin.top],
                    [tl_margin.left + tl_width, tl_margin.top + tl_height]])
                    .on("brush", brush)
                    .on("end", brush));
            brush_pic.exit().remove();

        });
        return ans;
    }
    scaledMainXGen() {
        let w = this._width;
        let scaleMainX = d3.scaleLinear().domain([0, 80]).range([w, 0]);
        return function (loc) {
            return scaleMainX(loc[1]);
        };
    }
    scaledMainYGen() {
        let h = this._height;
        let scaleMainY = d3.scaleLinear().domain([0, 120]).range([h, 0]);
        return function (loc) {
            return scaleMainY(loc[0]);
        };
    }
    draw_main() {
        let width = this._width, height = this._height, margin = this._margin;
        let div = d3.select(this._dom);
        function main_template(div, width, height, margin) {//篮球场
            let innerField = div.append("svg")
                .attr("class", "innerField")
                .attr("width", width + margin.left + margin.right)
                .attr("height", height + margin.top + margin.bottom);

            innerField.append("defs").append("marker")
                .attr("fill", "#95491F")
                .attr("id", "endmarkerA")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 30)
                .attr("refY", -1.5)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M0,-5L10,0L0,5");

            innerField.append("defs").append("marker")
                .attr("fill", "#1D588F")
                .attr("id", "endmarkerB")
                .attr("viewBox", "0 -5 10 10")
                .attr("refX", 30)
                .attr("refY", -1.5)
                .attr("markerWidth", 6)
                .attr("markerHeight", 6)
                .attr("orient", "auto")
                .append("path")
                .attr("d", "M0,-5L10,0L0,5");

            let ratio = width / 80;

            innerField.append('rect')
                .attr('class', 'innerSketch0')
                .attr('x', margin.left + 26.93335 * ratio)
                .attr('y', 6 * ratio)
                .attr('width', 26.13333 * ratio)
                .attr('height', 30.93333 * ratio);

            innerField.append('rect')
                .attr('class', 'innerSketch0')
                .attr('x', margin.left + 26.93335 * ratio)
                .attr('y', (126 - 30.93333) * ratio)
                .attr('width', 26.13333 * ratio)
                .attr('height', 30.93333 * ratio);

            innerField.append('rect')
                .attr('class', 'innerSketch')
                .attr('id', 'border')
                .attr('x', margin.left + 0)
                .attr('y', 6 * ratio)
                .attr('width', 80 * ratio)
                .attr('height', 120 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 0)
                .attr('y1', 66 * ratio)
                .attr('x2', margin.left + 80 * ratio)
                .attr('y2', 66 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 4 * ratio)
                .attr('y1', 6 * ratio)
                .attr('x2', margin.left + 4 * ratio)
                .attr('y2', 14.4 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 76 * ratio)
                .attr('y1', 6 * ratio)
                .attr('x2', margin.left + 76 * ratio)
                .attr('y2', 14.4 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 36 * ratio)
                .attr('y1', 7 * ratio)
                .attr('x2', margin.left + 45 * ratio)
                .attr('y2', 7 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 40.5 * ratio)
                .attr('y1', 7 * ratio)
                .attr('x2', margin.left + 40.5 * ratio)
                .attr('y2', 8.5 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 36 * ratio)
                .attr('y1', 125 * ratio)
                .attr('x2', margin.left + 45 * ratio)
                .attr('y2', 125 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 40.5 * ratio)
                .attr('y1', 125 * ratio)
                .attr('x2', margin.left + 40.5 * ratio)
                .attr('y2', 123.5 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 4 * ratio)
                .attr('y1', 126 * ratio)
                .attr('x2', margin.left + 4 * ratio)
                .attr('y2', 117.6 * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 76 * ratio)
                .attr('y1', 126 * ratio)
                .attr('x2', margin.left + 76 * ratio)
                .attr('y2', 117.6 * ratio);

            //两条中轴线
            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 30.4 * ratio)
                .attr('y1', 6 * ratio)
                .attr('x2', margin.left + 30.4 * ratio)
                .attr('y2', (6 + 30.933) * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 49.6 * ratio)
                .attr('y1', 6 * ratio)
                .attr('x2', margin.left + 49.6 * ratio)
                .attr('y2', (6 + 30.933) * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 49.6 * ratio)
                .attr('y1', 126 * ratio)
                .attr('x2', margin.left + 49.6 * ratio)
                .attr('y2', (126 - 30.933) * ratio);

            innerField.append('line')
                .attr('class', 'innerSketch')
                .attr('x1', margin.left + 30.4 * ratio)
                .attr('y1', 126 * ratio)
                .attr('x2', margin.left + 30.4 * ratio)
                .attr('y2', (126 - 30.933) * ratio);


            innerField.append('circle')
                .attr('class', 'innerSketch')
                .attr('cx', margin.left + 40 * ratio)
                .attr('cy', 66 * ratio)
                .attr('r', 9.6 * ratio);

            innerField.append('circle')
                .attr('class', 'innerSketch')
                .attr('cx', margin.left + 40.5 * ratio)
                .attr('cy', 10.2 * ratio)
                .attr('r', 1.7 * ratio);

            innerField.append('circle')
                .attr('class', 'innerSketch')
                .attr('cx', margin.left + 40.5 * ratio)
                .attr('cy', 121.8 * ratio)
                .attr('r', 1.7 * ratio);

            function polarToCartesian(centerX, centerY, radius, angleInDegrees) {
                var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
                return {
                    x: centerX + (radius * Math.cos(angleInRadians)),
                    y: centerY + (radius * Math.sin(angleInRadians))
                };
            }

            function describeArc(x, y, radius, startAngle, endAngle) {
                var x = margin.left + x;
                var start = polarToCartesian(x, y, radius, endAngle);
                var end = polarToCartesian(x, y, radius, startAngle);
                var arcSweep = endAngle - startAngle <= 180 ? "0" : "1";
                if (endAngle == 45 || endAngle == 225) {
                    var d = [
                        "M", start.x, start.y,
                        "A", radius, radius, 0, arcSweep, 0, end.x, end.y,
                        "L", start.x, start.y
                    ].join(" ");
                } else {
                    var d = [
                        "M", start.x, start.y,
                        "A", radius, radius, 0, arcSweep, 0, end.x, end.y,
                    ].join(" ");

                }
                return d;
            }

            var arc = [describeArc(40 * ratio, 36.9333 * ratio, 9.6 * ratio, 90, 270),
            describeArc(40 * ratio, 95.0667 * ratio, 9.6 * ratio, 270, 90),
            describeArc(40 * ratio, 14.4 * ratio, 36 * ratio, 90, 270),
            describeArc(40 * ratio, 117.6 * ratio, 36 * ratio, 270, 90),
            describeArc(40.5 * ratio, 8 * ratio, 7 * ratio, 90, 270),
            describeArc(40.5 * ratio, 124 * ratio, 7 * ratio, 270, 90),
            ];

            for (var i = 0; i < arc.length; i++) {
                innerField.append('path')
                    .attr('class', 'innerSketch')
                    .attr('d', arc[i]);
            }
        }
        main_template(div, width, height, margin);
        return this;
    }
    async draw() {
        let _this = this;
        if (this._not_first_draw) {
            if (this._team_dom) {
                await this.team_dom_uptime();
            }
            if (this._timeline) {
                await _this.timeline_uptime();
            }
            this.draw_qiuyuan();
        } else {
            this.draw_main();
            if (this._team_dom) {
                await this.team_dom_uptime();
            }
            if (this._timeline) {
                await _this.timeline_uptime();
            }
            this._not_first_draw = true;
            _this.draw();
        }
        return this;
    }

    draw_qiuyuan() {
        let _this = this,svg = d3.select(this._dom).select("svg"),margin = this._margin;
        const allgames = this._games,teams = this._teams;
        Promise.all([allgames, teams]).then(function ([allgames, teams]) {
            let allgames_avl = allgames.filter(d => {
                let time = d.minute * 60 + d.second;
                return time >= d3.min(_this._begin_end) && time <= d3.max(_this._begin_end);
            });
            const team_id1 = teams[0].team_id,team_id2 = teams[1].team_id;
            if (_this._thisteam === "1") {
                allgames_avl = allgames_avl.filter(d => {
                    return d.team.id === team_id1;
                });
            }
            if (_this._thisteam === "2") {
                allgames_avl = allgames_avl.filter(d => {
                    return d.team.id === team_id2;
                });
            }
            let pass_ball = allgames_avl.filter(d => {
                if (d.type.name === "Pass") {
                    if (d.pass.jieqiufan !== undefined)
                        return true;
                }
                return false;
            });

            echarts.dispose(document.getElementById('main_echart'));//销毁之前的图
            echarts.dispose(document.getElementById('main_echart_b'));
            echarts.dispose(document.getElementById('main_echart_c'));
            function get_option(sc, big = false) {
                var option = {
                    legend: {},
                    tooltip: {},
                    backgroundColor: '#ffffff',//背景色
                    dataset: { source: sc },
                    xAxis: { type: 'category' },
                    yAxis: big ? {
                        type: 'log',
                        min: 1,
                        logBase: 10
                    } : {},
                    series: Array(sc[0].length - 1).fill({ type: 'bar' }),
                    grid: {
                        left: '3%', //默认10%
                        right: '4%', //默认10%
                        bottom: '5%', //默认60
                        containLabel: true //grid区域是否包含坐标轴的刻度标签
                    }
                };
                return option;
            }
            const chooseplayer = _this._thisplayer;
            if (chooseplayer !== null) {
                pass_ball = pass_ball.filter(d => {
                    if (d.player.id === chooseplayer)
                        return true;
                    if (d.pass.jieqiufan.id === chooseplayer)
                        return true;
                    return false;
                });
                const player_stats0 = _this._player_stats, all_player_stats = _this._all_player_stats;
                Promise.all([player_stats0, all_player_stats]).then(function ([player_stats0, all_player_stats]) {
                    const player_stats = player_stats0[String(chooseplayer)];
                    function xz(keys, di, big, f) {
                        const sc = [['product', player_stats["名字"], 'NBA平均值', 'NBA最高值']];
                        for (const i in keys) {
                            const key = keys[i];
                            sc.push([key, player_stats[key], all_player_stats['平均' + key], all_player_stats['最大' + key]]);
                        }
                        Promise.all([_this._theme]).then(function ([themeJSON]) {
                            echarts.registerTheme('vintage', themeJSON);
                            var myChart = echarts.init(document.getElementById(di), 'vintage');
                            myChart.setOption(f(sc, big));
                        });
                    }
                    xz(_this._skeys, 'main_echart', false, get_option);
                    xz(_this._bkeys, 'main_echart_b', true, get_option);
                    xz(_this._pkeys, 'main_echart_c', false, get_option);
                    const name = player_stats["名字"];
                    toulanweizhi(name);
                });
            } else {
                const all_player_stats = _this._all_player_stats;
                Promise.all([all_player_stats]).then(function ([all_player_stats]) {
                    function wxz(keys, di, big, f) {
                        const sc = [['product', 'NBA平均值', 'NBA最高值']];
                        for (const i in keys) {
                            const key = keys[i];
                            sc.push([key, all_player_stats['平均' + key], all_player_stats['最大' + key]]);
                        }
                        Promise.all([_this._theme]).then(function ([themeJSON]) {
                            echarts.registerTheme('vintage', themeJSON);
                            var myChart = echarts.init(document.getElementById(di), 'vintage');
                            myChart.setOption(f(sc, big));
                        });
                    }
                    wxz(_this._skeys, 'main_echart', false, get_option);
                    wxz(_this._bkeys, 'main_echart_b', true, get_option);
                    wxz(_this._pkeys, 'main_echart_c', false, get_option);
                });
            }
            const toulan = allgames_avl.filter(d => {
                if (d.type.name === "Shot")
                    return true;
                return false;
            });
            let players = pass_ball.reduce(function (players, game) {
                let player_id = game.player.id;
                players[player_id] = players[player_id] || {
                    "name": game.player.name,
                    "team_id": game.team.id,
                    "id": player_id,
                    "location": [],
                    "recipient_location": []
                };
                players[player_id].location.push(game.location);
                let recipient_id = game.pass.jieqiufan.id;
                let recipient_name = game.pass.jieqiufan.name;
                players[recipient_id] = players[recipient_id] || {
                    "name": recipient_name,
                    "team_id": game.pass.jieqiufan.team.id,
                    "id": recipient_id,
                    "location": [],
                    "recipient_location": []
                };
                players[recipient_id].recipient_location.push(game.pass.end_location);
                return players;
            }, Object.create(null));
            players = Object.values(players);
            players.forEach(player => {
                let team = player.team_id,id2 = teams[1].team_id;
                player.avg_loc = [
                    d3.mean([...player.location, ...player.recipient_location], d => d[0]),
                    d3.mean([...player.location, ...player.recipient_location], d => d[1])
                ];
                if (team === id2) {
                    player.avg_loc[0] = 120 - player.avg_loc[0];
                    player.avg_loc[1] = 80 - player.avg_loc[1];
                }
            });
            const allplayer = new Set(players.map(player => player.id));
            const allplayer_toulan = new Set(toulan.map(d => d.player.id));
            pass_ball = pass_ball.filter(d => allplayer.has(d.pass.jieqiufan.id));
            let link_pic = svg.selectAll("g.links").data([0]);
            link_pic.enter()
                .append("g")
                .attr("class", "links")
                .attr("transform", `translate(${margin.left},${margin.top})`);
            link_pic = svg.selectAll("g.links");

            let players_pic = svg.selectAll("g.players").data([0]);
            players_pic.enter()
                .append("g")
                .attr("class", "players")
                .attr("transform", `translate(${margin.left},${margin.top})`);
            players_pic = svg.selectAll("g.players");

            const scaleMainX = _this.scaledMainXGen();
            const scaleMainY = _this.scaledMainYGen();

            draw_cuanqiu();
            draw_qiuyuan();

            function draw_cuanqiu() {
                const cuanqiu_cengong = function (game) {
                    return game.pass.outcome === undefined;
                };
                let paths = link_pic.selectAll("path.cuanqiu_road").data(pass_ball, d => d.id);
                paths.exit().remove();
                paths.enter()
                    .append("path")
                    .attr("class", "cuanqiu_road")
                    .attr("stroke", d => {
                        if (d.team.id === teams[0].team_id)
                            return "Crimson";
                        else if (d.team.id === teams[1].team_id)
                            return "DodgerBlue";
                    })
                    .attr("fill", "none")
                    .attr("stroke-width", 1.5)
                    .attr("stroke-opacity", 0.8)
                    .attr("stroke-dasharray", d => {
                        if (cuanqiu_cengong(d))
                            return "none";
                        return "0,2 1";
                    })
                    .attr("marker-end", d => {
                        let T;
                        if (d.team.id === teams[0].team_id)
                            T = "1";
                        else if (d.team.id === teams[1].team_id)
                            T = "2";
                        return `url(#endmarker${T})`;
                    })
                    .attr("d", d => {
                        let playerloc = players.find(p => p.id == d.player.id).avg_loc;
                        let px = scaleMainX(playerloc),py = scaleMainY(playerloc);
                        return `M${px},${py}A${1},${1} 0 0,1 ${px + 1},${py + 1}`;
                    })
                    .merge(paths)
                    .transition()
                    .duration(200)
                    .ease(d3.easeLinear)
                    .attr("d", d => {
                        let x = scaleMainX(d.location);
                        let y = scaleMainY(d.location);
                        let xend = scaleMainX(d.pass.end_location);
                        let yend = scaleMainY(d.pass.end_location);
                        let playerloc = players.find(p => p.id == d.player.id).avg_loc;
                        let reciploc = players.find(p => p.id == d.pass.jieqiufan.id).avg_loc;
                        let dist = Math.pow((Math.pow((yend - y), 2) + Math.pow((xend - x), 2)), 0.5);
                        if (dist === 0) dist = 0.5;
                        let player_avgdist = Math.pow((Math.pow((playerloc[0] - reciploc[0]), 2) +
                            Math.pow((playerloc[1] - reciploc[1]), 2)), 0.5);
                        let r = player_avgdist * (40 / (dist / player_avgdist));
                        let px = scaleMainX(playerloc);
                        let py = scaleMainY(playerloc);
                        let recipient_x = scaleMainX(reciploc);
                        let recipient_y = scaleMainY(reciploc);
                        let ret = `M${px},${py}A${r},${r} 0 0,1 ${recipient_x},${recipient_y}`;
                        return ret;
                    });
                paths.exit().remove();
            }

            function draw_qiuyuan() {
                const color1 = d3.scaleSequential(d3.interpolateOranges)
                    .domain([d3.min(players, d => d.location.length + d.recipient_location.length) - 10,
                    d3.max(players, d => d.location.length + d.recipient_location.length)])
                    .nice();
                const color2 = d3.scaleSequential(d3.interpolateBlues)
                    .domain([d3.min(players, d => d.location.length + d.recipient_location.length) - 10,
                    d3.max(players, d => d.location.length + d.recipient_location.length)])
                    .nice();
                const to_label = function (team_id) {
                    let Id1 = teams[0].team_id;
                    let id2 = teams[1].team_id;
                    if (team_id === Id1)
                        return "1";
                    if (team_id === id2)
                        return "2";
                    return null;
                };
                const color3 = function (player) {
                    let pass_num = player.location.length + player.recipient_location.length;
                    let team = to_label(player.team_id);
                    if (team === "1")
                        return color1(pass_num);
                    if (team === "2")
                        return color2(pass_num);
                    return null;
                };
                let player_location = players_pic
                    .selectAll("circle.player_location")
                    .data(players, d => d.id);

                player_location
                    .enter()
                    .append("circle")
                    .attr("class", "player_location")
                    .attr("cx", d => scaleMainX(d.avg_loc))
                    .attr("cy", d => scaleMainY(d.avg_loc))
                    .attr("opacity", d => {
                        return 0.8;
                    })
                    .on('click', function (d) {
                        let this_playerid = d3.select(this).datum().id;
                        let cur_chooseplayer = _this._thisplayer;
                        if (cur_chooseplayer === null) {
                            _this.chooseplayer(this_playerid);
                        }
                        else if (cur_chooseplayer === this_playerid) {
                            _this.chooseplayer(null);
                        }
                        else {
                            _this.chooseplayer(this_playerid);
                        }
                        _this.draw();
                    })
                    .on('mouseover', function () {
                        d3.select(this).style("cursor", "pointer");
                    })
                    .merge(player_location)
                    .transition()
                    .duration(200)
                    .ease(d3.easeLinear)
                    .attr("r", 20)
                    .attr("cx", d => scaleMainX(d.avg_loc))
                    .attr("cy", d => scaleMainY(d.avg_loc))
                    .attr("fill", d => color3(d))
                    .attr("stroke", d => {
                        if (allplayer_toulan.has(d.id))
                            return "white";
                        else
                            return "none";
                    })
                    .attr("stroke-width", 4);
                player_location
                    .exit()
                    .remove();
                let player_names = players_pic.selectAll("text.player_name").data(players, d => d.id);
                player_names
                    .enter()
                    .append("text")
                    .attr("class", "player_name")
                    .attr("x", d => scaleMainX(d.avg_loc))
                    .attr("y", d => scaleMainY(d.avg_loc))
                    .text(d => d.name.split(" ").slice(-1)[0])
                    .merge(player_names)
                    .transition()
                    .duration(200)
                    .ease(d3.easeLinear)
                    .attr("x", d => scaleMainX(d.avg_loc))
                    .attr("y", d => scaleMainY(d.avg_loc));
                player_names
                    .exit()
                    .remove();
            }
        });
    }
}
class Qiuchang {
    constructor(svg) {
        this.svg = svg;
    }

    drawqiuchang() {
        const Width = 500;
        const Height = 470;

        const pi = Math.PI;

        //背景板
        this.svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', Width)
            .attr('height', Height)
            .attr('fill', '#e8b787e0');

        this.svg.append('rect')
            .attr('x', 170)
            .attr('y', 0)
            .attr('width', 160)
            .attr('height', 190)
            .attr("stroke", "white")
            .attr("stroke-width", "2px")
            .attr('fill', 'rgba(166, 11, 11, 0.58)');

        // 三分线
        this.svg.append("line")
            .attr("x1", 30)
            .attr("y1", 0)
            .attr("x2", 30)
            .attr("y2", 140)
            .attr("stroke-width", "2px")
            .attr("stroke", "white");

        // 三分线
        this.svg.append("line")
            .attr("x1", 470)
            .attr("y1", 0)
            .attr("x2", 470)
            .attr("y2", 140)
            .attr("stroke-width", "2px")
            .attr("stroke", "white");
        // 三分线
        const sanfenxian = d3.arc()
            .innerRadius(239)
            .outerRadius(240)
            .startAngle(-90 * (pi / 180))
            .endAngle(90 * (pi / 180))
        this.svg.append("path")
            .attr("d", sanfenxian)
            .attr("stroke-width", "2px")
            .attr("fill", "white")
            .attr("transform", "rotate(180) translate(-250, -45)")

        // 覆盖
        this.svg.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 29.5)
            .attr('height', 150)
            .attr('fill', '#e8b787e0');

        this.svg.append('rect')
            .attr('x', 470.5)
            .attr('y', 0)
            .attr('width', 29)
            .attr('height', 140)
            .attr('fill', '#e8b787e0');

        this.svg.append('rect')
            .attr('x', 10)
            .attr('y', 0)
            .attr('width', Width - 20)
            .attr('height', Height - 65)
            .attr("stroke", "white")
            .attr("stroke-width", "2px")
            .attr("fill-opacity", 0);


        this.svg.append("line")
            .attr("x1", 220)
            .attr("y1", 40)
            .attr("x2", 280)
            .attr("y2", 40)
            .attr("stroke", "#e8b787e0")
            .attr("stroke-width", "0.3%");


        this.svg.append("circle")
            .attr("cx", 250)
            .attr("cy", 52.5)
            .attr("r", 7.5)
            .attr("fill-opacity", 0)
            .attr("stroke", "white");


        this.svg.append('rect')
            .attr('x', 246.5)
            .attr('y', 40)
            .attr('width', 7)
            .attr('height', 5)
            .attr('fill', 'white');


        const t = d3.arc()
            .innerRadius(40)
            .outerRadius(41)
            .startAngle(-90 * (pi / 180))
            .endAngle(90 * (pi / 180))

        this.svg.append("path")
            .attr("d", t)
            .attr("fill", "white")
            .attr("transform", "rotate(180) translate(-250, -40)")


        this.svg.append('rect')
            .attr('x', 470.5)
            .attr('y', 430)
            .attr('width', 50)
            .attr('height', 12)
            .attr('fill', 'skyblue')

        this.svg.append("text")
            .attr("x", 426)
            .attr("y", 436)
            .attr("font-size", 14)
            .attr("font-weight", "bold")
            .attr("dy", ".35em")
            .attr("font-family", "Oswald")
            .text("Made")
            .style("fill", "black")


        this.svg.append('rect')
            .attr('x', 470.5)
            .attr('y', 410)
            .attr('width', 50)
            .attr('height', 12)
            .attr('fill', 'darkred')

        this.svg.append("text")
            .attr("x", 417)
            .attr("y", 416)
            .attr("dy", ".35em")
            .attr("font-size", 14)
            .attr("font-weight", "bold")
            .attr("font-family", "Oswald")
            .text("Missed")
            .style("fill", "black")
    }
}

class Toulan {
    constructor(svg, qiuyuan, time, period) {
        this.svg = svg;
        this.played = false;
        this.all_player_toulan = d3.csv(`./data/all_players.csv`)
        d3.csv(`./data/all_players.csv`)
            .then(function (d) {
                d.forEach(player => {
                    const shijian = time === undefined ? true : player.game_time === time;
                    const saiji = period === undefined ? true : period.period === period;
                    if (player.name === qiuyuan && shijian && saiji) {
                        this.played = true;
                        if (player.toulan_cengong === "1") {
                            this.drawtoulan([player.x, player.y], "成功");
                        } else {
                            this.drawtoulan([player.x, player.y], "失败");
                        }
                    }
                })
                if (!this.played) this.meiyou();
            }.bind(this))
    }

    meiyou() {
        this.svg.append("text")
            .attr("x", 50)
            .attr("y", 150)
            .attr("dy", ".35em")
            .attr("font-size", 34)
            .attr("font-family", "Oswald")
            .text("没有记录")
            .style("fill", "#D5D5D5")
    }

    drawtoulan(weizhi, toulan_jieguo) {
        const hexbin = d3.hexbin().radius(5);
        if (toulan_jieguo === "成功") {
            this.svg.append("g")
                .selectAll(".hexagon")
                .data(hexbin([weizhi]))
                .enter().append("path")
                .attr("d", function (d) {
                    return "M" + d.x + "," + d.y + hexbin.hexagon();
                })
                .attr("stroke", "white")
                .attr('transform', 'translate(250, 52.5)')
                .attr("fill", "skyblue")
                .attr("fill-opacity", 0.7)
                .attr("stroke-width", "0.1px");
        } else if (toulan_jieguo === "失败") {
            this.svg.append("g")
                .selectAll(".hexagon")
                .data(hexbin([weizhi]))
                .enter().append("path")
                .attr("d", function (d) {
                    return "M" + d.x + "," + d.y + hexbin.hexagon();
                })
                .attr("stroke", "white")
                .attr('transform', 'translate(250, 52.5)')
                .attr("fill", "darkred")
                .attr("fill-opacity", 0.7)
                .attr("stroke-width", "0.1px");
        }
    }
}
