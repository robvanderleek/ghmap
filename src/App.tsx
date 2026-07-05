import * as d3 from "d3";
import {useEffect, useState} from "react";
import {Octokit} from "octokit";

interface Repo {
    name: string;
    value: number;
}

interface HierarchyRootNode {
    name: 'root';
    children: Array<Repo>;
}

function App() {
    const renderChart = (hierarchy: any) => {
        const width = 800;
        const height = 600;

        const data = d3.hierarchy(hierarchy);

        const root = d3.treemap<Repo>()
            .tile(d3.treemapSquarify) // e.g., d3.treemapSquarify
            .size([width, height])
            .padding(1)
            .round(true)
            (data
                .sum(d => d.value || 0)
                .sort((a, b) => (b.value || 0) - (a.value || 0)));

        return (
            <svg width={width} height={height}>
                {root.leaves().map((d, i) => (
                    <g key={i} transform={`translate(${d.x0},${d.y0})`}>
                        <rect
                            width={d.x1 - d.x0}
                            height={d.y1 - d.y0}
                            fill="transparent"
                            stroke="black"
                        />
                        <title>{d.data.name}</title>
                        <text x={4} y={14} fontSize="10px" fill="black">
                            {d.data.name}
                        </text>
                    </g>
                ))}
            </svg>
        );
    }

    const [hierarchy, setHierarchy] = useState<HierarchyRootNode | undefined>(undefined);

    useEffect(() => {
        const loadHierarchy = async (owner: string): Promise<HierarchyRootNode> => {
            const octokit = new Octokit({auth: import.meta.env.VITE_GITHUB_TOKEN});
            const res = await octokit.rest.repos.listForOrg({org: owner, per_page: 100});
            const result: HierarchyRootNode = {name: 'root', children: []};
            for (const repo of res.data) {
                const res = await octokit.rest.repos.listLanguages({owner, repo: repo.name});
                const languages = res.data;
                const totalNrOfBytes = Object.entries(languages).map(([_, nrOfBytes]) => nrOfBytes)
                    .reduce((prev, cur) => prev + cur, 0);
                result.children.push({name: repo.name, value: totalNrOfBytes});
            }
            return result;
        }

        const load = async () => {
            const owner = import.meta.env.VITE_GITHUB_OWNER;
            const cachedHierarchy = localStorage.getItem(`ghmap_${owner}`);
            if (cachedHierarchy) {
                setHierarchy(JSON.parse(cachedHierarchy));
            } else {
                const hierarchy = await loadHierarchy(owner);
                setHierarchy(hierarchy);
                localStorage.setItem(`ghmap_${owner}`, JSON.stringify(hierarchy));
            }
        }
        load();
    }, []);

    if (hierarchy) {
        return (
            <div style={{height: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                {renderChart(hierarchy)}
            </div>
        );
    } else {
        return (<h1>Loading...</h1>);
    }
}

export default App
