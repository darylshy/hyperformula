import {AddressMapping} from '../AddressMapping'
import {RangeMapping} from '../RangeMapping'
import {SheetMapping} from '../SheetMapping'
import {SimpleCellAddress} from '../Cell'
import {CellDependency} from '../CellDependency'
import {findSmallerRange} from '../interpreter/plugin/SumprodPlugin'
import {Graph} from '../Graph'
import {Ast} from '../parser'
import {AbsoluteCellRange} from '../AbsoluteCellRange'
import {
  CellVertex,
  EmptyCellVertex,
  FormulaCellVertex,
  MatrixVertex,
  RangeVertex,
  ValueCellVertex,
  Vertex
} from '../Vertex'

export class DependencyGraph {
  public recentlyChangedVertices: Set<Vertex> = new Set()

  constructor(
    private readonly addressMapping: AddressMapping,
    private readonly rangeMapping: RangeMapping,
    private readonly graph: Graph<Vertex>,
    private readonly sheetMapping: SheetMapping,
  ) {
  }

  public setFormulaToCell(address: SimpleCellAddress, ast: Ast, dependencies: CellDependency[]) {
    const vertex = this.addressMapping.getCell(address)

    if (vertex instanceof FormulaCellVertex) {
      vertex.setFormula(ast)
      this.processCellDependencies(dependencies, vertex)
      this.recentlyChangedVertices.add(vertex)
      return
    } else {
      throw Error("Not implemented yet")
    }
  }

  public clearRecentlyChangedVertices() {
    this.recentlyChangedVertices = new Set()
  }

  public processCellDependencies(cellDependencies: CellDependency[], endVertex: Vertex) {
    cellDependencies.forEach((absStartCell: CellDependency) => {
      if (absStartCell instanceof AbsoluteCellRange) {
        const range = absStartCell
        let rangeVertex = this.rangeMapping.getRange(range.start, range.end)
        if (rangeVertex === null) {
          rangeVertex = new RangeVertex(range)
          this.rangeMapping.setRange(rangeVertex)
        }

        this.graph.addNode(rangeVertex)

        const {smallerRangeVertex, restRanges} = findSmallerRange(this.rangeMapping, [range])
        const restRange = restRanges[0]
        if (smallerRangeVertex) {
          this.graph.addEdge(smallerRangeVertex, rangeVertex)
        }

        const matrix = this.addressMapping.getMatrix(restRange)
        if (matrix !== undefined) {
          this.graph.addEdge(matrix, rangeVertex)
        } else {
          for (const cellFromRange of restRange.generateCellsFromRangeGenerator()) {
            this.graph.addEdge(fetchOrCreateEmptyCell(this.graph, this.addressMapping, cellFromRange), rangeVertex)
          }
        }
        this.graph.addEdge(rangeVertex, endVertex)
      } else {
        this.graph.addEdge(fetchOrCreateEmptyCell(this.graph, this.addressMapping, absStartCell), endVertex)
      }
    })
  }
}

export function fetchOrCreateEmptyCell(graph: Graph<Vertex>, addressMapping: AddressMapping, address: SimpleCellAddress): CellVertex {
  let vertex = addressMapping.getCell(address)
  if (!vertex) {
    vertex = new EmptyCellVertex()
    graph.addNode(vertex)
    addressMapping.setCell(address, vertex)
  }
  return vertex
}
